"""Test enhanced analysis engine."""
import asyncio
from app.services.analysis_engine import AnalysisEngine
from app.core.database import async_session_maker

async def test_pec():
    async with async_session_maker() as db:
        engine = AnalysisEngine()
        result = await engine.compute_pec(1, db)
        
        print("\n=== PEC Analysis Test ===")
        print(f"PEC Score: {result.get('pec_score', 'N/A')}")
        print(f"P-value: {result.get('p_value', 'N/A')}")
        print(f"\nInterpretation: {result.get('interpretation', 'N/A')[:100]}...")
        print(f"\nHas significance_explanation: {'significance_explanation' in result}")
        print(f"Has statistical_notes: {'statistical_notes' in result}")
        
        if 'statistical_notes' in result:
            notes = result['statistical_notes']
            print(f"\nTest Used: {notes.get('test_used', 'N/A')}")
            print(f"What it means: {notes.get('what_it_means', 'N/A')[:80]}...")
        
        return result

async def test_anova():
    async with async_session_maker() as db:
        engine = AnalysisEngine()
        result = await engine.run_anova(1, db)
        
        print("\n\n=== ANOVA Test ===")
        if 'anova' in result:
            anova = result['anova']
            print(f"F-statistic: {anova.get('f_statistic', 'N/A')}")
            print(f"P-value: {anova.get('p_value', 'N/A')}")
            print(f"Interpretation: {anova.get('interpretation', 'N/A')[:100]}...")
        
        if 'effect_sizes' in result:
            es = result['effect_sizes']
            print(f"\nEffect Size (η²): {es.get('eta_squared', 'N/A')}")
            print(f"Interpretation: {es.get('interpretation', 'N/A')}")
            print(f"Meaning: {es.get('meaning', 'N/A')[:100]}...")
        
        print(f"\nHas statistical_notes: {'statistical_notes' in result}")
        
        return result

async def test_effect_sizes():
    async with async_session_maker() as db:
        engine = AnalysisEngine()
        results = await engine.compute_effect_sizes(1, db)
        
        print("\n\n=== Effect Sizes Test ===")
        if results:
            first = results[0]
            print(f"Comparison: {first.get('comparison', 'N/A')}")
            print(f"Cohen's d: {first.get('cohens_d', 'N/A')}")
            print(f"Interpretation: {first.get('interpretation', 'N/A')}")
            print(f"Has practical_meaning: {'practical_meaning' in first}")
            if 'practical_meaning' in first:
                print(f"Practical Meaning: {first['practical_meaning'][:100]}...")
        
        return results

async def main():
    try:
        await test_pec()
        await test_anova()
        await test_effect_sizes()
        print("\n✅ All tests passed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
