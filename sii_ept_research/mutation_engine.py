# -*- coding: utf-8 -*-
"""
Reconstruction of the Mutation Engine and Semantic Instability Index (SII)
as specified in the manuscript (Table I, Eq. 3, Algorithm 1).

This is an independent re-implementation built from the paper's written
description (the original implementation was not available to us). It is
used to generate a real, reproducible dataset for (a) a small-model pilot
replication and (b) an SII-coefficient sensitivity analysis. All numbers
downstream of this file are computed from actual code execution, not
invented.
"""

import random
import re
import string

random.seed(42)

# --------------------------------------------------------------------------
# SII base scores (Table I)
# --------------------------------------------------------------------------
SII_BASE = {
    "baseline": 0.00,
    "noise_typo": 0.80,
    "noise_verbose": 1.00,
    "formality_shift": 1.20,
    "code_switching": 1.40,
    "ambiguity_semantic": 1.50,
    "negation": 1.60,
    "reordering": 1.70,
    "ambiguity_contradiction": 2.50,
}

MUTATION_TYPES = list(SII_BASE.keys())

GAMMA = 0.02
DELTA = 0.50
EPSILON = 0.30

# --------------------------------------------------------------------------
# Lexicons
# --------------------------------------------------------------------------

KEYBOARD_ADJACENCY = {
    "q": "wa", "w": "qes", "e": "wrd", "r": "etf", "t": "ryg", "y": "tuh",
    "u": "yij", "i": "uok", "o": "ipl", "p": "ol", "a": "qsz", "s": "awd",
    "d": "sef", "f": "drg", "g": "fth", "h": "gyj", "j": "huk", "k": "jil",
    "l": "kop", "z": "asx", "x": "zsc", "c": "xdv", "v": "cfb", "b": "vgn",
    "n": "bhm", "m": "njk",
}  # 26 keys with adjacency lists (>=30 adjacency edges in total)

FILLER_PHRASES = [
    "as far as I understand it", "if it's not too much trouble",
    "just to be clear about this", "in a manner of speaking",
    "to the best of my knowledge", "if you don't mind me asking",
    "more or less", "at the end of the day", "for what it's worth",
    "in some sense or another", "as it were", "so to speak",
    "in one way or another", "if that makes sense", "to put it another way",
    "more specifically speaking", "as things stand right now",
    "in a certain sense", "if I'm being honest", "as one might expect",
    "in the grand scheme of things", "to some extent at least",
    "as luck would have it", "in a roundabout way",
]

FORMALITY_PAIRS = [
    ("help", "assist"), ("get", "obtain"), ("big", "substantial"),
    ("show", "demonstrate"), ("use", "utilise"), ("start", "commence"),
    ("end", "conclude"), ("find out", "ascertain"), ("tell", "inform"),
    ("buy", "procure"), ("fix", "rectify"), ("ask", "inquire"),
    ("think", "posit"), ("make", "produce"), ("give", "provide"),
    ("about", "regarding"), ("also", "furthermore"), ("but", "however"),
    ("so", "therefore"), ("a lot of", "a considerable amount of"),
]

CODE_SWITCH_PHRASES = [
    "(por favor)", "(s'il vous plaît)", "(bitte)", "(por supuesto)",
    "(bien sûr)", "(natürlich)", "(gracias)", "(merci)",
    "(danke)", "(en efecto)",
]

VAGUE_QUANTIFIERS = ["some", "several", "a few", "a certain number of",
                      "various"]
VAGUE_PRONOUN_TARGETS = ["it", "that thing", "this one", "the thing in question"]

ANTONYM_PAIRS = [
    ("increase", "decrease"), ("large", "small"), ("fast", "slow"),
    ("hot", "cold"), ("easy", "difficult"), ("safe", "dangerous"),
    ("good", "bad"), ("high", "low"), ("open", "closed"),
    ("strong", "weak"), ("full", "empty"), ("early", "late"),
    ("cheap", "expensive"), ("clean", "dirty"), ("light", "heavy"),
    ("young", "old"), ("simple", "complex"), ("true", "false"),
    ("possible", "impossible"), ("efficient", "inefficient"),
]

NEGATION_TARGETS = [" is ", " are ", " can ", " will ", " does ", " has "]

CONTRADICTORY_CLAUSES = [
    "However, none of this is actually the case.",
    "At the same time, the opposite is also true.",
    "Although, in fact, this never happens.",
    "Yet this directly contradicts what was just stated.",
    "Despite that, the reverse holds equally well.",
]


def _split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


def _count_vowel_clusters(word):
    word = word.lower()
    clusters = re.findall(r"[aeiouy]+", word)
    n = len(clusters)
    return max(n, 1)


def flesch_reading_ease(text):
    words = re.findall(r"[A-Za-z']+", text)
    sentences = _split_sentences(text)
    n_words = max(len(words), 1)
    n_sentences = max(len(sentences), 1)
    n_syllables = sum(_count_vowel_clusters(w) for w in words) or n_words
    return 206.835 - 1.015 * (n_words / n_sentences) - 84.6 * (n_syllables / n_words)


def lexical_diversity(text):
    words = [w.lower() for w in re.findall(r"[A-Za-z']+", text)]
    if not words:
        return 1.0
    return len(set(words)) / len(words)


def sentence_complexity(text):
    sentences = _split_sentences(text)
    if not sentences:
        return 0.0
    lengths = [len(re.findall(r"[A-Za-z']+", s)) for s in sentences]
    if not lengths or max(lengths) == 0:
        return 0.0
    return (sum(lengths) / len(lengths)) / max(lengths)


def compute_sii(mutated_text, baseline_text, mutation_type, alpha,
                gamma=GAMMA, delta=DELTA, epsilon=EPSILON, base_scores=None):
    base_scores = base_scores or SII_BASE
    b_m = base_scores[mutation_type]
    F0 = flesch_reading_ease(baseline_text)
    F = flesch_reading_ease(mutated_text)
    dF = F - F0
    LD = lexical_diversity(mutated_text)
    Cx = sentence_complexity(mutated_text)
    sii = b_m * alpha + gamma * abs(dF) + delta * (1 - LD) + epsilon * Cx
    return min(sii, 5.0)


# --------------------------------------------------------------------------
# Mutation operators
# --------------------------------------------------------------------------

def _mutate_typo(text, alpha, rng):
    chars = list(text)
    n_targets = max(1, int(len(chars) * 0.5 * alpha))
    idxs = [i for i, c in enumerate(chars) if c.lower() in KEYBOARD_ADJACENCY]
    rng.shuffle(idxs)
    for i in idxs[:n_targets]:
        c = chars[i]
        op = rng.choice(["swap", "delete", "double"])
        neighbours = KEYBOARD_ADJACENCY.get(c.lower(), "")
        if op == "swap" and neighbours:
            repl = rng.choice(neighbours)
            chars[i] = repl.upper() if c.isupper() else repl
        elif op == "delete":
            chars[i] = ""
        elif op == "double":
            chars[i] = c + c
    out = "".join(chars)
    return out if out.strip() and out != text else text + " "


def _mutate_verbose(text, alpha, rng):
    sentences = _split_sentences(text)
    n_inserts = max(1, int(len(sentences) * alpha) + 1)
    fillers = rng.sample(FILLER_PHRASES, k=min(n_inserts, len(FILLER_PHRASES)))
    out_sentences = []
    for i, s in enumerate(sentences):
        if i < len(fillers):
            clauses = s.split(",")
            if len(clauses) > 1:
                clauses[0] = clauses[0] + f", {fillers[i]},"
                s = ",".join(clauses)
            else:
                s = f"{fillers[i].capitalize()}, {s[0].lower() + s[1:]}" if s else s
        out_sentences.append(s)
    return " ".join(out_sentences)


def _mutate_formality(text, alpha, rng):
    out = text
    n_targets = max(1, int(len(FORMALITY_PAIRS) * alpha))
    pairs = rng.sample(FORMALITY_PAIRS, k=n_targets)
    for informal, formal in pairs:
        pattern = re.compile(r"\b" + re.escape(informal) + r"\b", re.IGNORECASE)
        if pattern.search(out):
            out = pattern.sub(formal, out, count=1)
    return out


def _mutate_code_switch(text, alpha, rng):
    sentences = _split_sentences(text)
    n_inserts = max(1, int(len(sentences) * alpha))
    phrases = rng.sample(CODE_SWITCH_PHRASES, k=min(n_inserts, len(CODE_SWITCH_PHRASES)))
    out_sentences = list(sentences)
    for i, phrase in enumerate(phrases):
        if i < len(out_sentences):
            s = out_sentences[i].rstrip()
            if s.endswith((".", "!", "?")):
                out_sentences[i] = s[:-1] + " " + phrase + s[-1]
            else:
                out_sentences[i] = s + " " + phrase
    return " ".join(out_sentences)


def _mutate_ambiguity_semantic(text, alpha, rng):
    words = text.split()
    n_targets = max(1, int(len(words) * 0.3 * alpha))
    nouns_idx = [i for i, w in enumerate(words) if len(w) > 4 and w.isalpha()]
    rng.shuffle(nouns_idx)
    for i in nouns_idx[:n_targets]:
        if rng.random() < 0.5:
            words[i] = rng.choice(VAGUE_PRONOUN_TARGETS)
        else:
            words.insert(i, rng.choice(VAGUE_QUANTIFIERS))
    return " ".join(words)


def _mutate_negation(text, alpha, rng):
    out = text
    matched = False
    for target in NEGATION_TARGETS:
        if target in out:
            out = out.replace(target, target + "not ", 1)
            matched = True
            break
    if not matched:
        # fallback: insert negation phrase at nearest clause boundary
        sentences = _split_sentences(text)
        if sentences:
            sentences[0] = "It is not the case that " + sentences[0][0].lower() + sentences[0][1:]
            out = " ".join(sentences)
        else:
            out = "It is not the case that " + text
    return out


def _mutate_reordering(text, alpha, rng):
    sentences = _split_sentences(text)
    if len(sentences) > 1:
        rng.shuffle(sentences)
        out = " ".join(sentences)
    else:
        words = text.rstrip(".!? ").split()
        rng.shuffle(words)
        out = " ".join(words) + "."
    # additional within-sentence shuffle proportional to alpha
    if rng.random() < alpha:
        parts = out.split()
        if len(parts) > 4:
            i, j = rng.sample(range(len(parts)), 2)
            parts[i], parts[j] = parts[j], parts[i]
            out = " ".join(parts)
    return out


def _mutate_contradiction(text, alpha, rng):
    out = text
    changed = False
    pairs = rng.sample(ANTONYM_PAIRS, k=len(ANTONYM_PAIRS))
    for word, antonym in pairs:
        pattern = re.compile(r"\b" + re.escape(word) + r"\b", re.IGNORECASE)
        if pattern.search(out):
            out = pattern.sub(antonym, out, count=1)
            changed = True
            break
    clause = rng.choice(CONTRADICTORY_CLAUSES)
    out = out.rstrip() + " " + clause
    changed = True
    return out


MUTATORS = {
    "noise_typo": _mutate_typo,
    "noise_verbose": _mutate_verbose,
    "formality_shift": _mutate_formality,
    "code_switching": _mutate_code_switch,
    "ambiguity_semantic": _mutate_ambiguity_semantic,
    "negation": _mutate_negation,
    "reordering": _mutate_reordering,
    "ambiguity_contradiction": _mutate_contradiction,
}


def apply_mutation(text, mutation_type, alpha, seed=None):
    rng = random.Random(seed)
    if mutation_type == "baseline":
        return text
    mutator = MUTATORS[mutation_type]
    out = mutator(text, alpha, rng)
    # uniqueness check: retry once with a different seed if unchanged
    if out.strip() == text.strip():
        out = mutator(text, min(1.0, alpha + 0.2), random.Random((seed or 0) + 1))
    return out
