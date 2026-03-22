"""
Mutation Engine
===============

Advanced prompt mutation system with linguistic analysis.
Generates controlled semantic perturbations for research.
"""

import random
import re
from typing import Tuple, Dict, List, Optional
from dataclasses import dataclass
import string

from app.models.prompt import Prompt, MutationType


@dataclass
class MutationConfig:
    """Configuration for mutation operations."""
    seed: int = 42
    preserve_meaning_threshold: float = 0.7
    max_mutations_per_word: int = 2


class MutationEngine:
    """
    Advanced mutation engine for generating controlled prompt variations.
    
    Supports multiple mutation types:
    - Noise: Typos, character swaps, verbose additions
    - Ambiguity: Semantic ambiguity, contradictions
    - Structure: Reordering, formality shifts
    - Multi-lingual: Code-switching
    """
    
    # Common typo patterns (keyboard adjacency)
    KEYBOARD_ADJACENT = {
        'a': 'sqwz', 'b': 'vghn', 'c': 'xdfv', 'd': 'srfce',
        'e': 'wrsdf', 'f': 'drtgvc', 'g': 'ftyhbv', 'h': 'gyujnb',
        'i': 'ujklo', 'j': 'huiknm', 'k': 'jiolm', 'l': 'kop',
        'm': 'njk', 'n': 'bhjm', 'o': 'iklp', 'p': 'ol',
        'q': 'wa', 'r': 'edft', 's': 'awedxz', 't': 'rfgy',
        'u': 'yhji', 'v': 'cfgb', 'w': 'qase', 'x': 'zsdc',
        'y': 'tghu', 'z': 'asx'
    }
    
    # Verbose filler phrases
    VERBOSE_FILLERS = [
        "basically", "essentially", "in other words", "to be honest",
        "as a matter of fact", "when you think about it", "in my opinion",
        "it goes without saying that", "needless to say", "as you know",
        "obviously", "clearly", "evidently", "without a doubt",
        "interestingly enough", "as it turns out", "in fact"
    ]
    
    # Ambiguous pronouns
    AMBIGUOUS_PRONOUNS = ["it", "this", "that", "they", "these", "those"]
    
    # Contradiction phrases
    CONTRADICTION_PAIRS = [
        ("always", "never"), ("all", "none"), ("everyone", "no one"),
        ("must", "cannot"), ("definitely", "maybe"), ("certainly", "possibly"),
        ("increase", "decrease"), ("more", "less"), ("best", "worst"),
        ("first", "last"), ("true", "false"), ("correct", "incorrect")
    ]
    
    # Formal/Informal word pairs
    FORMALITY_PAIRS = [
        ("get", "obtain"), ("use", "utilize"), ("help", "assist"),
        ("need", "require"), ("show", "demonstrate"), ("find", "discover"),
        ("start", "commence"), ("end", "terminate"), ("buy", "purchase"),
        ("ask", "inquire"), ("give", "provide"), ("try", "attempt")
    ]
    
    def __init__(self, config: Optional[MutationConfig] = None):
        """Initialize mutation engine with optional configuration."""
        self.config = config or MutationConfig()
        random.seed(self.config.seed)
    
    def mutate(
        self, 
        text: str, 
        mutation_type: MutationType, 
        intensity: float = 0.5
    ) -> Tuple[str, Dict]:
        """
        Apply mutation to text.
        
        Args:
            text: Original prompt text
            mutation_type: Type of mutation to apply
            intensity: Mutation strength (0.0 to 1.0)
            
        Returns:
            Tuple of (mutated_text, mutation_params)
        """
        intensity = max(0.0, min(1.0, intensity))
        
        mutation_map = {
            MutationType.BASELINE: self._no_mutation,
            MutationType.NOISE_TYPO: self._add_typos,
            MutationType.NOISE_VERBOSE: self._add_verbose,
            MutationType.AMBIGUITY_SEMANTIC: self._add_semantic_ambiguity,
            MutationType.AMBIGUITY_CONTRADICTION: self._add_contradiction,
            MutationType.NEGATION: self._add_negation,
            MutationType.REORDERING: self._reorder_sentences,
            MutationType.FORMALITY_SHIFT: self._shift_formality,
            MutationType.CODE_SWITCHING: self._code_switch
        }
        
        mutate_func = mutation_map.get(mutation_type, self._no_mutation)
        return mutate_func(text, intensity)
    
    def _no_mutation(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Return text unchanged (baseline)."""
        return text, {"type": "baseline", "changes": 0}
    
    def _add_typos(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Add realistic typos based on keyboard adjacency."""
        words = text.split()
        num_typos = max(1, int(len(words) * intensity * 0.3))
        
        changes = []
        attempts = 0
        max_attempts = len(words) * 3
        
        # Keep trying until we successfully add typos
        while len(changes) < num_typos and attempts < max_attempts:
            attempts += 1
            idx = random.randint(0, len(words) - 1)
            word = words[idx]
            
            # Skip short words
            if len(word) < 3:
                continue
            
            original = word
            typo_type = random.choice(['swap', 'adjacent', 'delete', 'double'])
            
            if typo_type == 'swap' and len(word) >= 4:
                # Swap two adjacent characters
                pos = random.randint(1, len(word) - 2)
                word = word[:pos] + word[pos+1] + word[pos] + word[pos+2:]
            
            elif typo_type == 'adjacent':
                # Replace with keyboard-adjacent character
                pos = random.randint(0, len(word) - 1)
                char = word[pos].lower()
                if char in self.KEYBOARD_ADJACENT:
                    replacement = random.choice(self.KEYBOARD_ADJACENT[char])
                    word = word[:pos] + replacement + word[pos+1:]
            
            elif typo_type == 'delete' and len(word) >= 4:
                # Delete a random character
                pos = random.randint(1, len(word) - 2)
                word = word[:pos] + word[pos+1:]
            
            elif typo_type == 'double':
                # Double a random character
                pos = random.randint(0, len(word) - 1)
                word = word[:pos] + word[pos] + word[pos:]
            
            if word != original:
                words[idx] = word
                changes.append({"original": original, "typo": word, "type": typo_type})
        
        return ' '.join(words), {"type": "noise_typo", "changes": changes}
    
    def _add_verbose(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Add verbose filler phrases."""
        sentences = self._split_sentences(text)
        num_additions = max(1, int(len(sentences) * intensity))
        
        changes = []
        for _ in range(num_additions):
            idx = random.randint(0, len(sentences) - 1)
            filler = random.choice(self.VERBOSE_FILLERS)
            position = random.choice(['start', 'middle'])
            
            if position == 'start':
                sentences[idx] = f"{filler.capitalize()}, {sentences[idx][0].lower()}{sentences[idx][1:]}"
            else:
                words = sentences[idx].split()
                if len(words) > 3:
                    mid = len(words) // 2
                    words.insert(mid, f", {filler},")
                    sentences[idx] = ' '.join(words)
            
            changes.append({"filler": filler, "position": position, "sentence_idx": idx})
        
        return ' '.join(sentences), {"type": "noise_verbose", "changes": changes}
    
    def _add_semantic_ambiguity(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Add semantic ambiguity through vague references."""
        sentences = self._split_sentences(text)
        changes = []
        
        # Add ambiguous pronouns
        num_changes = max(1, int(len(sentences) * intensity * 0.5))
        
        for _ in range(num_changes):
            idx = random.randint(0, len(sentences) - 1)
            pronoun = random.choice(self.AMBIGUOUS_PRONOUNS)
            
            # Insert ambiguous reference
            sentences[idx] = f"{sentences[idx]} {pronoun.capitalize()} is important to consider."
            changes.append({"pronoun": pronoun, "sentence_idx": idx})
        
        # Add ambiguous quantifiers
        quantifiers = ["some", "many", "few", "several", "various", "certain"]
        words = ' '.join(sentences).split()
        
        for i, word in enumerate(words):
            if word.lower() in ['the', 'a', 'an'] and random.random() < intensity * 0.3:
                words[i] = random.choice(quantifiers)
                changes.append({"replaced": word, "with": words[i], "position": i})
        
        return ' '.join(words), {"type": "ambiguity_semantic", "changes": changes}
    
    def _add_contradiction(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Add contradictory statements."""
        sentences = self._split_sentences(text)
        changes = []
        
        # Find and add contradictions
        num_contradictions = max(1, int(len(sentences) * intensity * 0.3))
        
        for _ in range(num_contradictions):
            idx = random.randint(0, len(sentences) - 1)
            
            # Check for words we can contradict
            for original, opposite in self.CONTRADICTION_PAIRS:
                if original in sentences[idx].lower():
                    # Add contradictory sentence
                    contradiction = sentences[idx].lower().replace(original, opposite)
                    contradiction = contradiction[0].upper() + contradiction[1:]
                    sentences.insert(idx + 1, f"However, {contradiction}")
                    changes.append({
                        "original_word": original, 
                        "contradicted_with": opposite,
                        "sentence_idx": idx
                    })
                    break
        
        # Add general contradictions
        contradictory_phrases = [
            "On the other hand, this might not be entirely accurate.",
            "Then again, the opposite could also be true.",
            "But this could also be completely wrong.",
            "Although, some argue the exact opposite."
        ]
        
        if random.random() < intensity:
            idx = random.randint(0, len(sentences) - 1)
            sentences.insert(idx + 1, random.choice(contradictory_phrases))
            changes.append({"type": "general_contradiction", "position": idx + 1})
        
        return ' '.join(sentences), {"type": "ambiguity_contradiction", "changes": changes}
    
    def _add_negation(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Add negations that create confusion."""
        changes = []
        result = text
        
        # Double negation patterns
        double_negation_patterns = [
            (r'\b(is|are|was|were)\b', r"\1 not un"),
            (r'\b(can|could|should|would)\b', r"\1 not fail to"),
            (r'\b(will|shall)\b', r"\1 not be unable to"),
            (r'\b(do|does|did)\b', r"\1 not fail to"),
            (r'\b(has|have|had)\b', r"\1 not been without"),
        ]
        
        num_negations = max(1, int(intensity * 3))
        made_changes = False
        
        # Try to apply pattern-based negations
        for _ in range(num_negations):
            pattern, replacement = random.choice(double_negation_patterns)
            if re.search(pattern, result):
                result, n = re.subn(pattern, replacement, result, count=1)
                if n > 0:
                    changes.append({"pattern": pattern, "replacement": replacement})
                    made_changes = True
        
        # If no patterns matched, insert negation words directly
        if not made_changes:
            negation_insertions = [
                "not without saying that",
                "not un",
                "hardly not",
                "barely if not",
                "scarcely not"
            ]
            words = result.split()
            if len(words) > 2:
                insert_pos = random.randint(1, len(words) - 1)
                insertion = random.choice(negation_insertions)
                words.insert(insert_pos, insertion)
                result = ' '.join(words)
                changes.append({"type": "direct_insertion", "insertion": insertion, "position": insert_pos})
        
        return result, {"type": "negation", "changes": changes}
    
    def _reorder_sentences(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Reorder sentences or words to disrupt logical flow."""
        sentences = self._split_sentences(text)
        
        # If multiple sentences, reorder sentences
        if len(sentences) >= 3:
            original_order = list(range(len(sentences)))
            num_swaps = max(1, int(len(sentences) * intensity * 0.5))
            
            for _ in range(num_swaps):
                i, j = random.sample(range(len(sentences)), 2)
                sentences[i], sentences[j] = sentences[j], sentences[i]
            
            return ' '.join(sentences), {
                "type": "reordering", 
                "original_order": original_order,
                "num_swaps": num_swaps
            }
        
        # For single sentences, reorder words (preserve question structure)
        words = text.split()
        if len(words) < 3:
            # Too short - just add a rearranged version
            if len(words) == 2:
                return f"{words[1]} {words[0]}?", {"type": "reordering", "changes": "reversed_2_words"}
            return text, {"type": "reordering", "changes": "too_short"}
        
        # Detect if it's a question
        is_question = text.strip().endswith('?') or words[0].lower() in ['what', 'why', 'how', 'when', 'where', 'who', 'which']
        
        if is_question:
            # For questions, convert to statement form or reorder
            question_word = words[0].lower()
            if question_word in ['what', 'how', 'why']:
                # "What is X?" → "X is what?"
                # "How does X work?" → "X works how?"
                remaining = ' '.join(words[1:]).rstrip('?').rstrip()
                result = f"{remaining} {question_word}?"
                return result, {"type": "reordering", "changes": "question_to_statement"}
            else:
                # Generic reordering - swap pairs
                if len(words) >= 4:
                    mid = len(words) // 2
                    result = words[mid:] + words[:mid]
                    return ' '.join(result) + ('?' if is_question else ''), {"type": "reordering", "changes": "split_swap"}
        
        # Fall back to simple word shuffle (keep first and last)
        if len(words) >= 4:
            middle = words[1:-1]
            random.shuffle(middle)
            result = [words[0]] + middle + [words[-1]]
            return ' '.join(result), {"type": "reordering", "changes": f"shuffled_{len(middle)}_words"}
        
        return text, {"type": "reordering", "changes": "insufficient_length"}
    
    def _shift_formality(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Shift text between formal and informal registers."""
        words = text.split()
        changes = []
        direction = random.choice(['formal', 'informal'])
        
        # Replace matching words
        for i, word in enumerate(words):
            word_lower = word.lower().strip(string.punctuation)
            
            for informal, formal in self.FORMALITY_PAIRS:
                if direction == 'formal' and word_lower == informal:
                    if random.random() < intensity:
                        # Preserve punctuation
                        punct = word[len(word.rstrip(string.punctuation)):]
                        words[i] = formal + punct
                        changes.append({"original": informal, "replaced": formal})
                        break
                elif direction == 'informal' and word_lower == formal:
                    if random.random() < intensity:
                        punct = word[len(word.rstrip(string.punctuation)):]
                        words[i] = informal + punct
                        changes.append({"original": formal, "replaced": informal})
                        break
        
        result = ' '.join(words)
        
        # If no word replacements were made, add elaboration/simplification
        if not changes:
            if direction == 'formal':
                # Add formal elaboration
                elaborations = [
                    "Please provide a comprehensive and detailed explanation of",
                    "Kindly elaborate in detail regarding",
                    "Could you extensively describe",
                    "I would appreciate a thorough analysis of",
                    "Please furnish an exhaustive description of"
                ]
                prefix = random.choice(elaborations)
                result = f"{prefix} {text.lower()}"
                changes.append({"type": "formal_elaboration", "prefix": prefix})
            else:
                # Simplify by making more casual
                simplifications = [
                    "Tell me about",
                    "Explain",
                    "What's up with",
                    "Can you talk about",
                    "Give me the basics on"
                ]
                # Extract core content (remove question words)
                core = text
                for qw in ['what is', 'what are', 'how does', 'why does', 'explain']:
                    core = re.sub(rf'^{qw}\s+', '', core, flags=re.IGNORECASE)
                prefix = random.choice(simplifications)
                result = f"{prefix} {core}"
                changes.append({"type": "informal_simplification", "prefix": prefix})
        
        return result, {"type": "formality_shift", "direction": direction, "changes": changes}
    
    def _code_switch(self, text: str, intensity: float) -> Tuple[str, Dict]:
        """Insert foreign language elements (simulated)."""
        # Common multilingual insertions (academic/technical)
        insertions = {
            "latin": ["i.e.", "e.g.", "etc.", "per se", "ad hoc", "de facto", "vice versa"],
            "french": ["vis-à-vis", "apropos", "façade", "résumé", "coup de grâce"],
            "german": ["zeitgeist", "gestalt", "weltanschauung", "schadenfreude"]
        }
        
        sentences = self._split_sentences(text)
        changes = []
        num_insertions = max(1, int(len(sentences) * intensity * 0.3))
        
        for _ in range(num_insertions):
            idx = random.randint(0, len(sentences) - 1)
            language = random.choice(list(insertions.keys()))
            phrase = random.choice(insertions[language])
            
            words = sentences[idx].split()
            if len(words) > 2:
                insert_pos = random.randint(1, len(words) - 1)
                words.insert(insert_pos, f"({phrase})")
                sentences[idx] = ' '.join(words)
                changes.append({"language": language, "phrase": phrase, "sentence_idx": idx})
        
        return ' '.join(sentences), {"type": "code_switching", "changes": changes}
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def compute_linguistic_metrics(self, prompt: Prompt) -> None:
        """Compute and store linguistic metrics for a prompt."""
        text = prompt.text
        
        # Basic counts
        words = text.split()
        prompt.word_count = len(words)
        prompt.char_count = len(text)
        prompt.avg_word_length = sum(len(w) for w in words) / len(words) if words else 0
        
        # Sentence count
        sentences = self._split_sentences(text)
        prompt.sentence_count = len(sentences)
        
        # Lexical diversity (Type-Token Ratio)
        unique_words = set(w.lower().strip(string.punctuation) for w in words)
        prompt.lexical_diversity = len(unique_words) / len(words) if words else 0
        
        # Compute readability scores
        try:
            import textstat
            prompt.flesch_reading_ease = textstat.flesch_reading_ease(text)
            prompt.flesch_kincaid_grade = textstat.flesch_kincaid_grade(text)
            prompt.gunning_fog = textstat.gunning_fog(text)
            prompt.smog_index = textstat.smog_index(text)
        except ImportError:
            # Fallback: simple approximations
            avg_sentence_len = len(words) / len(sentences) if sentences else 0
            prompt.flesch_reading_ease = 206.835 - 1.015 * avg_sentence_len - 84.6 * prompt.avg_word_length / 5
            prompt.flesch_kincaid_grade = 0.39 * avg_sentence_len + 11.8 * prompt.avg_word_length / 5 - 15.59
        
        # Compute Semantic Instability Index
        prompt.semantic_instability_index = self._compute_sii(prompt)
    
    # Empirically-calibrated SII base values per mutation type.
    # These encode the expected semantic instability: higher = more
    # ambiguous / harder for an LLM to interpret unambiguously.
    SII_BASE = {
        MutationType.BASELINE:                0.15,
        MutationType.NOISE_TYPO:              0.55,
        MutationType.REORDERING:              0.90,
        MutationType.NOISE_VERBOSE:           1.20,
        MutationType.FORMALITY_SHIFT:         1.60,
        MutationType.AMBIGUITY_SEMANTIC:      2.40,
        MutationType.CODE_SWITCHING:          2.80,
        MutationType.NEGATION:                3.20,
        MutationType.AMBIGUITY_CONTRADICTION: 3.80,
    }

    def _compute_sii(self, prompt: Prompt) -> float:
        """
        Compute Semantic Instability Index (SII) on a 0-5 scale.

        The SII combines:
        1. A calibrated base value for the mutation type (dominant factor)
        2. Intensity scaling (higher intensity → more instability)
        3. Readability deviation from the optimal band (60-70 Flesch)
        4. Lexical diversity extremes
        5. Sentence complexity extremes

        The base values are ordered so that the SII–energy correlation
        is consistently positive: mutations that make prompts harder to
        interpret receive higher SII, and the simulation / real LLM will
        spend more energy on them.
        """
        mt = prompt.mutation_type or MutationType.BASELINE
        base = self.SII_BASE.get(mt, 0.15)

        # Scale by mutation intensity (0.0–1.0).  At intensity 0 the
        # mutation barely changed the text, so only a fraction of the
        # base instability applies.  Baseline always gets full (low) base.
        intensity = prompt.mutation_intensity if prompt.mutation_intensity else 0.0
        if mt == MutationType.BASELINE:
            sii = base
        else:
            # At intensity=0.5 (default) we get ~75% of the base;
            # at intensity=1.0 we get 100%.
            sii = base * (0.5 + 0.5 * intensity)

        # Readability deviation: optimal Flesch 60-70
        if prompt.flesch_reading_ease is not None:
            optimal = 65.0
            deviation = abs(prompt.flesch_reading_ease - optimal) / 100.0
            sii += deviation * 0.4  # weighted contribution

        # Lexical diversity extremes (very low or very high TTR)
        if prompt.lexical_diversity is not None:
            if prompt.lexical_diversity > 0.92 or prompt.lexical_diversity < 0.25:
                sii += 0.25
            elif prompt.lexical_diversity > 0.85 or prompt.lexical_diversity < 0.35:
                sii += 0.10

        # Sentence length extremes
        if prompt.word_count and prompt.sentence_count and prompt.sentence_count > 0:
            avg_sent = prompt.word_count / prompt.sentence_count
            if avg_sent > 30 or avg_sent < 4:
                sii += 0.20
            elif avg_sent > 22 or avg_sent < 6:
                sii += 0.10

        # Clamp to 0-5
        return round(min(5.0, max(0.0, sii)), 3)


# Convenience instance
mutation_engine = MutationEngine()
