"""
LLM Service - Multi-Provider Support
====================================

Supports multiple LLM providers:
- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude)
- Simulation mode (for testing without API keys)
"""

import asyncio
import time
import random
from typing import Dict, Any, Optional
from app.core.logger import logger

from app.core.config import settings


class LLMService:
    """
    Multi-provider LLM inference service.
    
    Supports:
    - OpenAI API
    - Anthropic API
    - Simulation mode (no API needed)
    """
    
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        Initialize LLM service.
        
        Args:
            provider: "openai", "anthropic", or "simulation"
            api_key: API key for the provider
            model: Model name to use
        """
        self.provider = provider or settings.LLM_PROVIDER
        self.api_key = api_key
        self.model = model
        self.client = None
        
        # Set defaults based on provider
        if self.provider == "openai":
            self.api_key = self.api_key or settings.OPENAI_API_KEY
            self.model = self.model or settings.OPENAI_MODEL
        elif self.provider == "anthropic":
            self.api_key = self.api_key or settings.ANTHROPIC_API_KEY
            self.model = self.model or settings.ANTHROPIC_MODEL
        else:
            self.provider = "simulation"
            self.model = "simulation-model"
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the appropriate client based on provider."""
        if self.provider == "openai" and self.api_key:
            try:
                import openai
                self.client = openai.AsyncOpenAI(api_key=self.api_key)
                logger.info(f"OpenAI client initialized with model: {self.model}")
            except ImportError:
                logger.warning("openai package not installed. Using simulation mode. Run: pip install openai")
                self.provider = "simulation"
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI client: {e}. Using simulation mode.")
                self.provider = "simulation"
                
        elif self.provider == "anthropic" and self.api_key:
            try:
                import anthropic
                self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
                logger.info(f"Anthropic client initialized with model: {self.model}")
            except ImportError:
                logger.warning("anthropic package not installed. Using simulation mode. Run: pip install anthropic")
                self.provider = "simulation"
            except Exception as e:
                logger.warning(f"Failed to initialize Anthropic client: {e}. Using simulation mode.")
                self.provider = "simulation"
        else:
            if self.provider in ["openai", "anthropic"] and not self.api_key:
                logger.info(f"No API key configured for {self.provider}. Using simulation mode")
            self.provider = "simulation"
            logger.info("Using simulation mode (no API key configured)")
    
    async def generate(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Generate text from prompt using configured provider.
        
        Returns:
            Dictionary with:
            - text: Generated text
            - input_tokens: Number of input tokens
            - output_tokens: Number of output tokens
            - inference_time: Time taken in seconds
            - model_name: Name of model used
            - provider: Provider used
        """
        max_tokens = max_tokens or settings.MAX_TOKENS
        temperature = temperature or settings.TEMPERATURE
        
        start_time = time.time()
        
        try:
            if self.provider == "openai":
                result = await self._generate_openai(prompt, max_tokens, temperature)
            elif self.provider == "anthropic":
                result = await self._generate_anthropic(prompt, max_tokens, temperature)
            else:
                result = await self._generate_simulation(prompt, max_tokens)
            
            result["inference_time"] = time.time() - start_time
            result["provider"] = self.provider
            return result
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Generation error with {self.provider}: {error_msg}")
            
            # Check for specific API errors
            if "invalid_api_key" in error_msg.lower() or "401" in error_msg:
                logger.error("API Key is invalid or expired")
            elif "rate_limit" in error_msg.lower():
                logger.error("Rate limit exceeded - using simulation fallback")
            elif "authentication" in error_msg.lower():
                logger.error("Authentication failed - check your API key")
            
            # Fall back to simulation on error
            result = await self._generate_simulation(prompt, max_tokens)
            result["inference_time"] = time.time() - start_time
            result["provider"] = f"{self.provider} (fallback to simulation)"
            result["error"] = error_msg
            return result
    
    async def _generate_openai(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Generate using OpenAI API."""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return {
            "text": response.choices[0].message.content,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "model_name": self.model
        }
    
    async def _generate_anthropic(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float
    ) -> Dict[str, Any]:
        """Generate using Anthropic API."""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return {
            "text": response.content[0].text,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "model_name": self.model
        }
    
    async def _generate_simulation(
        self,
        prompt: str,
        max_tokens: int
    ) -> Dict[str, Any]:
        """
        Simulate LLM generation with physically-grounded energy model.

        The simulation models the key research hypothesis:
        Higher semantic instability → more computational work → more energy.

        Complexity drivers (cumulative):
        - Prompt length (more input tokens to process)
        - Lexical ambiguity (vague/overloaded words)
        - Structural complexity (nested clauses, long sentences)
        - Contradictions (conflicting signals force re-evaluation)
        - Verbose filler (extra tokens with low information density)
        """
        words = prompt.split()
        input_tokens = max(1, int(len(words) * 1.3))

        # ---- Complexity scoring (1.0 = clear baseline) ----
        complexity = 1.0

        # Length factor: longer prompts require more attention computation
        if len(words) > 30:
            complexity += 0.15
        if len(words) > 60:
            complexity += 0.15

        # Ambiguity signals in the text (vague references destabilize semantic grounding)
        ambiguity_words = {
            'it', 'this', 'that', 'they', 'these', 'those', 'some',
            'many', 'few', 'several', 'various', 'certain', 'thing',
            'stuff', 'something', 'somehow', 'somewhat',
        }
        prompt_lower = prompt.lower()
        ambiguity_hits = sum(1 for w in words if w.lower().strip('.,!?;:') in ambiguity_words)
        complexity += min(ambiguity_hits * 0.10, 0.7)

        # Filler / verbosity signals
        filler_phrases = [
            'basically', 'essentially', 'in other words', 'to be honest',
            'as a matter of fact', 'needless to say', 'obviously',
            'clearly', 'interestingly enough', 'as it turns out',
            'in my opinion', 'it goes without saying',
        ]
        filler_hits = sum(1 for f in filler_phrases if f in prompt_lower)
        complexity += min(filler_hits * 0.10, 0.4)

        # Contradiction signals (very high complexity - model must reconcile conflicts)
        contradiction_words = [
            'however', 'but', 'although', 'nevertheless', 'on the other hand',
            'conversely', 'then again', 'not entirely', 'opposite',
            'could also be wrong', 'might not be', 'could also be',
            'argue the exact opposite', 'completely wrong', 'not entirely accurate'
        ]
        contradiction_hits = sum(1 for c in contradiction_words if c in prompt_lower)
        complexity += min(contradiction_hits * 0.35, 1.5)

        # Structural complexity: long sentences, nested clauses
        sentences = [s.strip() for s in prompt.replace('!', '.').replace('?', '.').split('.') if s.strip()]
        if sentences:
            avg_sentence_len = len(words) / len(sentences)
            if avg_sentence_len > 25:
                complexity += 0.20
            elif avg_sentence_len > 18:
                complexity += 0.10

        # Comma density (proxy for subordinate clauses)
        comma_density = prompt.count(',') / max(len(words), 1)
        if comma_density > 0.15:
            complexity += 0.15

        # Elaboration requests ("explain", "comprehensive", "detail")
        elaboration_words = ['explain', 'describe', 'analyze', 'compare',
                            'comprehensive', 'detail', 'thorough', 'examples',
                            'extensive', 'kindly', 'elaborate', 'furnish']
        elab_hits = sum(1 for w in elaboration_words if w in prompt_lower)
        complexity += min(elab_hits * 0.08, 0.35)

        # Typo detection: look for common typo patterns
        # Character transpositions, doubled letters, unusual patterns
        typo_score = 0.0
        common_typos = {
            'waht', 'whta', 'teh', 'hte', 'adn', 'nad', 'recieve', 'beleive',
            'occured', 'seperate', 'definately', 'untill', 'goverment'
        }
        
        for word in words:
            word_clean = word.lower().strip('.,!?;:')
            if len(word_clean) < 3:
                continue
            
            # Check for known common typos
            if word_clean in common_typos:
                typo_score += 0.4
            
            # Check for doubled consonants in unusual positions
            for i in range(len(word_clean) - 1):
                if word_clean[i] == word_clean[i+1] and word_clean[i] in 'bcdfghjklmnpqrstvwxyz':
                    # Common doubles: ll, ss, tt, ff, nn, mm, ee, oo
                    if word_clean[i] not in 'lsftneom':
                        typo_score += 0.2
            
            # Check for keyboard adjacency errors (qwerty layout)
            # Common patterns: zs (as), zrt (art), znd (and)
            adjacent_errors = ['zrt', 'znd', 'zs ', ' zs', 'waht', 'hwo']
            for err in adjacent_errors:
                if err in word_clean:
                    typo_score += 0.25
            
            # Check for missing or extra characters (compared to common words)
            # If word length is very short compared to typical, likely a typo
            if word_clean in ['artifcial', 'intelligenc', 'artifical', 'intelligece']:
                typo_score += 0.3
        
        complexity += min(typo_score, 1.0)

        # Code-switching detection: foreign language insertions (Latin, French, German)
        code_switch_phrases = [
            'i.e.', 'e.g.', 'etc.', 'per se', 'ad hoc', 'de facto', 'vice versa',
            'vis-à-vis', 'apropos', 'façade', 'résumé', 'coup de grâce',
            'zeitgeist', 'gestalt', 'weltanschauung', 'schadenfreude'
        ]
        code_switch_hits = sum(1 for phrase in code_switch_phrases if phrase in prompt_lower)
        # Parenthetical insertions also indicate code-switching
        paren_count = prompt.count('(') + prompt.count(')')
        complexity += min(code_switch_hits * 0.45 + paren_count * 0.15, 1.3)

        # Negation complexity (double negatives - very confusing for models)
        negation_phrases = ['not un', 'not fail to', 'not be unable', 'cannot not',
                           'not in', 'neither', 'nor', "n't"]
        neg_hits = sum(1 for n in negation_phrases if n in prompt_lower)
        complexity += min(neg_hits * 0.40, 1.2)

        # Add controlled randomness (±8%) to model measurement noise
        noise = random.gauss(1.0, 0.04)
        complexity *= max(0.85, min(1.15, noise))

        # ---- Output token count: complex prompts produce longer outputs ----
        base_output = 60 + int(input_tokens * 0.5)
        output_tokens = int(base_output * complexity * random.uniform(0.92, 1.08))
        output_tokens = max(20, min(output_tokens, max_tokens))

        # ---- Simulate inference time (seconds) ----
        # Base: ~30ms per output token, scaled by complexity
        base_time = 0.15 + output_tokens * 0.025
        inference_time = base_time * (0.7 + complexity * 0.3) * random.uniform(0.93, 1.07)
        inference_time = max(0.1, min(inference_time, 5.0))

        await asyncio.sleep(min(inference_time, 2.0))

        # Generate a placeholder response
        responses = [
            f"Based on the query about {words[-1] if words else 'this topic'}, "
            "here is a comprehensive analysis. The key factors to consider include "
            "the fundamental principles involved, practical applications, and "
            "potential implications for further research.",

            "This question touches on several important aspects. First, we need to "
            "understand the underlying mechanisms. Second, we should consider the "
            "broader context. Third, practical applications demonstrate the real-world "
            "relevance of these concepts.",

            "The topic presented requires careful examination of multiple factors. "
            "Research indicates that there are significant relationships between "
            "the variables mentioned. Further analysis would provide additional insights "
            "into the mechanisms at play.",

            "To address this query comprehensively, we must consider both theoretical "
            "foundations and empirical evidence. The interaction between different "
            "components creates complex dynamics that require systematic analysis.",
        ]
        generated_text = random.choice(responses)

        return {
            "text": generated_text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model_name": "simulation-model",
            "_complexity": round(complexity, 4),
            "_inference_time_sim": round(inference_time, 4),
        }
    
    def get_info(self) -> Dict[str, Any]:
        """Get information about the current configuration."""
        return {
            "provider": self.provider,
            "model": self.model,
            "has_api_key": bool(self.api_key),
            "max_tokens": settings.MAX_TOKENS,
            "temperature": settings.TEMPERATURE
        }


# Create default instance
def get_llm_service(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> LLMService:
    """Factory function to create LLM service instances."""
    return LLMService(provider=provider, api_key=api_key, model=model)
