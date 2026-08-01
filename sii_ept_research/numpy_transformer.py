# -*- coding: utf-8 -*-
"""
Minimal decoder-only Transformer implemented in pure NumPy.

WHY THIS EXISTS (disclosed prominently, also repeated in the paper writeup):
This sandbox's network allowlist blocks huggingface.co, pytorch.org, and
their CDN mirrors (confirmed via direct connection tests: HTTP 403
"blocked-by-allowlist" from the egress proxy). It was therefore not
possible to download any pretrained open-weight model (GPT-2, TinyLlama,
etc.) in this environment. PyPI itself (files.pythonhosted.org) IS
reachable, but the `torch` wheel is >500MB and this sandbox's per-command
timeout (45s) and lack of persistent background processes across tool
calls made downloading it infeasible here too.

Rather than fake a "real model" result, we implement the actual core
computation a Transformer decoder performs -- causal multi-head
self-attention, softmax, feed-forward blocks, and logit sampling -- from
scratch in NumPy, and run REAL forward passes with REAL wall-clock/CPU
timing on this machine's real 2-core CPU.

Weights are randomly initialised (there was no feasible way to train or
download trained weights within this environment's time/network budget).
This means generated text is NOT semantically meaningful -- we say this
plainly, repeatedly, and do not present decoded text as coherent output.

What this DOES let us test honestly: whether per-output-token compute
time (EPT) varies across mutation conditions for a real, physically
executing Transformer architecture, purely as a function of input
length / context growth -- i.e., it isolates the architectural component
of the original paper's EPT metric from any semantic-understanding
component (which would require trained weights). This is reported as
exactly that: an architectural ablation, not a semantic validation.
"""
import numpy as np

VOCAB_SIZE = 256  # byte-level
D_MODEL = 64
N_HEADS = 4
N_LAYERS = 2
D_FF = 128
MAX_SEQ_LEN = 512


def _init_weights(seed=1234):
    rng = np.random.default_rng(seed)
    scale = 0.02
    W = {}
    W["embed"] = rng.normal(0, scale, (VOCAB_SIZE, D_MODEL))
    W["pos"] = rng.normal(0, scale, (MAX_SEQ_LEN, D_MODEL))
    W["layers"] = []
    for _ in range(N_LAYERS):
        layer = {
            "Wq": rng.normal(0, scale, (D_MODEL, D_MODEL)),
            "Wk": rng.normal(0, scale, (D_MODEL, D_MODEL)),
            "Wv": rng.normal(0, scale, (D_MODEL, D_MODEL)),
            "Wo": rng.normal(0, scale, (D_MODEL, D_MODEL)),
            "W1": rng.normal(0, scale, (D_MODEL, D_FF)),
            "b1": np.zeros(D_FF),
            "W2": rng.normal(0, scale, (D_FF, D_MODEL)),
            "b2": np.zeros(D_MODEL),
            "ln1_g": np.ones(D_MODEL), "ln1_b": np.zeros(D_MODEL),
            "ln2_g": np.ones(D_MODEL), "ln2_b": np.zeros(D_MODEL),
        }
        W["layers"].append(layer)
    W["ln_f_g"] = np.ones(D_MODEL)
    W["ln_f_b"] = np.zeros(D_MODEL)
    W["unembed"] = rng.normal(0, scale, (D_MODEL, VOCAB_SIZE))
    return W


_WEIGHTS = _init_weights()


def _layer_norm(x, g, b, eps=1e-5):
    mu = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    return g * (x - mu) / np.sqrt(var + eps) + b


def _softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)


def _causal_self_attention(x, layer):
    T, D = x.shape
    hd = D // N_HEADS
    Q = x @ layer["Wq"]
    K = x @ layer["Wk"]
    V = x @ layer["Wv"]
    Q = Q.reshape(T, N_HEADS, hd).transpose(1, 0, 2)
    K = K.reshape(T, N_HEADS, hd).transpose(1, 0, 2)
    V = V.reshape(T, N_HEADS, hd).transpose(1, 0, 2)
    scores = (Q @ K.transpose(0, 2, 1)) / np.sqrt(hd)
    mask = np.triu(np.ones((T, T)), k=1).astype(bool)
    scores = np.where(mask[None, :, :], -1e9, scores)
    attn = _softmax(scores, axis=-1)
    out = attn @ V
    out = out.transpose(1, 0, 2).reshape(T, D)
    return out @ layer["Wo"]


def _self_attention_with_cache(x_new, layer, cache):
    """x_new: (D,) single new-token residual stream (post-LN).
    cache: dict with 'K' and 'V' arrays of shape (N_HEADS, T_so_far, hd), or None.
    Returns (out (D,), updated_cache). Real KV-cached causal attention: cost
    per generated token is O(T_so_far), matching real autoregressive decoder
    serving rather than O(T^2) recomputation from scratch."""
    D = x_new.shape[-1]
    hd = D // N_HEADS
    q = (x_new @ layer["Wq"]).reshape(N_HEADS, hd)
    k = (x_new @ layer["Wk"]).reshape(N_HEADS, hd)
    v = (x_new @ layer["Wv"]).reshape(N_HEADS, hd)
    if cache is None:
        K = k[:, None, :]
        V = v[:, None, :]
    else:
        K = np.concatenate([cache["K"], k[:, None, :]], axis=1)
        V = np.concatenate([cache["V"], v[:, None, :]], axis=1)
    scores = np.einsum("hd,htd->ht", q, K) / np.sqrt(hd)
    attn = _softmax(scores, axis=-1)
    out = np.einsum("ht,htd->hd", attn, V).reshape(D)
    return out @ layer["Wo"], {"K": K, "V": V}


def _gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x ** 3)))


def forward_logits(token_ids, W=_WEIGHTS):
    """token_ids: 1D int array. Returns logits for the NEXT token (last position).
    (Reference, uncached, O(T^2) implementation -- kept for validation/testing
    the cached path against; not used in the timed experiment loop.)"""
    T = len(token_ids)
    x = W["embed"][token_ids] + W["pos"][:T]
    for layer in W["layers"]:
        a = _causal_self_attention(_layer_norm(x, layer["ln1_g"], layer["ln1_b"]), layer)
        x = x + a
        h = _layer_norm(x, layer["ln2_g"], layer["ln2_b"])
        h = _gelu(h @ layer["W1"] + layer["b1"]) @ layer["W2"] + layer["b2"]
        x = x + h
    x = _layer_norm(x, W["ln_f_g"], W["ln_f_b"])
    logits = x @ W["unembed"]
    return logits[-1]  # next-token logits


def _process_token_cached(token_id, pos_idx, caches, W=_WEIGHTS):
    """Process a single token through all layers using per-layer KV caches.
    This is a real KV-cached causal-attention decode step (as used by actual
    Transformer inference servers), not a naive O(T^2) recomputation."""
    x = W["embed"][token_id] + W["pos"][pos_idx]
    new_caches = []
    for layer, cache in zip(W["layers"], caches):
        xn = _layer_norm(x, layer["ln1_g"], layer["ln1_b"])
        a, new_cache = _self_attention_with_cache(xn, layer, cache)
        x = x + a
        h = _layer_norm(x, layer["ln2_g"], layer["ln2_b"])
        h = _gelu(h @ layer["W1"] + layer["b1"]) @ layer["W2"] + layer["b2"]
        x = x + h
        new_caches.append(new_cache)
    x = _layer_norm(x, W["ln_f_g"], W["ln_f_b"])
    logits = x @ W["unembed"]
    return logits, new_caches


def encode(text):
    b = text.encode("utf-8", errors="ignore")
    return np.frombuffer(b, dtype=np.uint8).astype(np.int64)


def decode(token_ids):
    b = bytes(int(t) for t in token_ids)
    return b.decode("utf-8", errors="replace")


def generate(prompt_text, max_new_tokens=40, temperature=0.7, top_p=0.95, seed=None,
             max_context=MAX_SEQ_LEN):
    """Real KV-cached autoregressive decoding: prefill the prompt token-by-token
    (building the cache), then generate max_new_tokens new tokens, each costing
    real, measured compute proportional to current context length -- exactly
    the mechanism real Transformer inference servers use."""
    rng = np.random.default_rng(seed)
    ids = list(encode(prompt_text))[-max_context:]
    n_in = len(ids)
    caches = [None] * N_LAYERS
    logits = None
    for pos, tid in enumerate(ids):
        logits, caches = _process_token_cached(tid, pos, caches)

    generated = []
    pos = n_in
    for _ in range(max_new_tokens):
        scaled = logits / max(temperature, 1e-6)
        probs = _softmax(scaled)
        order = np.argsort(-probs)
        sorted_probs = probs[order]
        cum = np.cumsum(sorted_probs)
        cutoff = np.searchsorted(cum, top_p) + 1
        keep = order[:cutoff]
        keep_probs = probs[keep]
        keep_probs = keep_probs / keep_probs.sum()
        next_id = int(rng.choice(keep, p=keep_probs))
        generated.append(next_id)
        if pos >= max_context - 1:
            break
        logits, caches = _process_token_cached(next_id, pos, caches)
        pos += 1
    return {
        "n_in_tokens": n_in,
        "n_out_tokens": len(generated),
        "output_text": decode(generated),
        "full_ids": ids + generated,
    }
