# -*- coding: utf-8 -*-
"""
Length-matched control: for a given model's real tokenizer, produce a
variant of the mutated prompt whose token count equals the baseline
prompt's own token count (per-record, per-model -- not a global constant,
since different tokenizers give different counts for the same text).

This directly tests whether SII-EPT correlation in mutation_engine.py's
raw output (which has NO length-control logic at all: noise_verbose and
ambiguity_contradiction always grow text, others may shrink/preserve it)
is attributable to length drift rather than semantic instability itself.
"""
import itertools
import re

from mutation_engine import FILLER_PHRASES, _split_sentences


def _n_tokens(tokenizer, text):
    return len(tokenizer(text, add_special_tokens=False)["input_ids"])


def _truncate_to_n_tokens(tokenizer, text, n_target):
    ids = tokenizer(text, add_special_tokens=False)["input_ids"]
    if len(ids) <= n_target:
        return text
    # prefer truncating at the last sentence boundary <= n_target tokens
    sentences = _split_sentences(text)
    if len(sentences) > 1:
        acc = ""
        best = None
        for s in sentences:
            candidate = (acc + " " + s).strip() if acc else s
            n = _n_tokens(tokenizer, candidate)
            if n <= n_target:
                best = candidate
                acc = candidate
            else:
                break
        if best is not None and _n_tokens(tokenizer, best) == n_target:
            return best
    # fall back to a hard token-index truncation
    truncated_ids = ids[:n_target]
    return tokenizer.decode(truncated_ids, skip_special_tokens=True)


def make_length_matched(tokenizer, baseline_text, mutated_text, rng, max_pad_iters=50):
    """
    Returns dict: {text, method, n_target_tokens, n_actual_tokens}
    `text` has (as close as achievable) the same token count under
    `tokenizer` as `baseline_text`.
    """
    n_target = _n_tokens(tokenizer, baseline_text)
    n_mut = _n_tokens(tokenizer, mutated_text)

    if n_mut == n_target:
        return {"text": mutated_text, "method": "exact",
                "n_target_tokens": n_target, "n_actual_tokens": n_mut}

    if n_mut > n_target:
        matched = _truncate_to_n_tokens(tokenizer, mutated_text, n_target)
        return {"text": matched, "method": "truncate",
                "n_target_tokens": n_target,
                "n_actual_tokens": _n_tokens(tokenizer, matched)}

    # n_mut < n_target: pad with neutral filler phrases (not the tokenizer's
    # pad token -- these are instruction-tuned models, a literal pad token
    # mid-prompt would be out-of-distribution, not length-neutral)
    text = mutated_text
    filler_cycle = itertools.cycle(rng.sample(FILLER_PHRASES, len(FILLER_PHRASES)))
    ids_len = n_mut
    guard = 0
    while ids_len < n_target and guard < max_pad_iters:
        text = text.rstrip() + " " + next(filler_cycle) + "."
        ids_len = _n_tokens(tokenizer, text)
        guard += 1

    if ids_len > n_target:
        text = _truncate_to_n_tokens(tokenizer, text, n_target)
        ids_len = _n_tokens(tokenizer, text)

    method = "pad" if guard > 0 else "exact"
    return {"text": text, "method": method,
            "n_target_tokens": n_target, "n_actual_tokens": ids_len}
