"""
Prompt Corpus
=============

60-prompt corpus (12 per domain x 5 domains), replacing the previous
10-item DEFAULT_PROMPTS list that made the documented 60-prompt x
9-condition protocol structurally impossible to run through this backend.
"""

FACTUAL_QA = [
    "What is the capital of Australia?",
    "Who wrote the novel Pride and Prejudice?",
    "What is the boiling point of water at sea level in Celsius?",
    "Which planet is closest to the sun?",
    "What year did the Berlin Wall fall?",
    "What is the chemical symbol for gold?",
    "How many continents are there on Earth?",
    "Who painted the Mona Lisa?",
    "What is the largest ocean on Earth?",
    "What gas do plants absorb from the atmosphere during photosynthesis?",
    "What is the tallest mountain in the world?",
    "Who was the first person to walk on the Moon?",
]

INSTRUCTION_FOLLOWING = [
    "Write a short paragraph explaining why regular exercise is beneficial for health.",
    "List three tips for improving time management at work.",
    "Explain how to make a basic vinaigrette dressing in three steps.",
    "Give me a simple daily routine for someone starting to learn a new language.",
    "Describe how to set up a budget for a small household in five steps.",
    "Suggest three icebreaker questions for a team meeting.",
    "Explain how to safely jump-start a car battery.",
    "Provide a short guide on how to prepare for a job interview.",
    "Describe the steps to plant a vegetable garden in containers.",
    "Explain how to back up files on a personal computer.",
    "Give instructions for setting up a tent while camping.",
    "Suggest a simple workout plan for beginners at home.",
]

SUMMARISATION = [
    "Summarise the plot of a story where a young sailor is shipwrecked and must survive alone on an island for years before being rescued.",
    "Summarise the main idea of an article arguing that cities should invest more in public transportation to reduce traffic congestion.",
    "Summarise a report describing how rising ocean temperatures are affecting coral reef ecosystems worldwide.",
    "Summarise a news story about a small business that successfully transitioned to an online-only sales model during an economic downturn.",
    "Summarise a research paper's findings on the effects of sleep deprivation on memory and decision-making.",
    "Summarise a historical account describing the causes and consequences of a major trade route's decline.",
    "Summarise an essay discussing the trade-offs between renewable energy adoption and grid reliability.",
    "Summarise a case study of a company that redesigned its supply chain to reduce shipping costs.",
    "Summarise a documentary transcript about the migration patterns of Arctic terns.",
    "Summarise a policy brief recommending changes to urban zoning laws to increase affordable housing.",
    "Summarise an interview with a chef discussing the challenges of running a sustainable restaurant.",
    "Summarise a scientific abstract describing a new method for desalinating seawater more efficiently.",
]

CODE_EXPLANATION = [
    "Explain what a binary search algorithm does and why it is faster than a linear search.",
    "Explain the difference between a stack and a queue data structure.",
    "Explain what a recursive function is and give a simple example in words.",
    "Explain how a hash table achieves fast lookups.",
    "Explain the purpose of a for-loop versus a while-loop in programming.",
    "Explain what an API is and why it is useful for software applications.",
    "Explain the difference between compiled and interpreted programming languages.",
    "Explain what a null pointer exception is and why it occurs.",
    "Explain how version control systems like Git help teams collaborate on code.",
    "Explain what Big-O notation measures in algorithm analysis.",
    "Explain the difference between synchronous and asynchronous code execution.",
    "Explain what a database index is and how it speeds up queries.",
]

CREATIVE_WRITING = [
    "Write a short poem about the changing seasons.",
    "Write a brief story opening about a lighthouse keeper who discovers a mysterious bottle washed ashore.",
    "Write a short description of a bustling morning market in a coastal town.",
    "Write a two-sentence story about a robot learning to paint.",
    "Write a short scene where two old friends reunite after twenty years apart.",
    "Write a brief fable about a tortoise who teaches a hare the value of patience.",
    "Write a short description of a quiet library at closing time.",
    "Write a brief story about a child who finds a map leading to a hidden garden.",
    "Write a short piece describing a train journey through the mountains at dawn.",
    "Write a brief story about a musician performing for an empty theatre during a storm.",
    "Write a short description of a small bakery on a rainy afternoon.",
    "Write a brief story about an astronaut watching Earth from a space station for the last time.",
]

PROMPT_CORPUS = []
for _domain, _prompts in [
    ("factual_qa", FACTUAL_QA),
    ("instruction_following", INSTRUCTION_FOLLOWING),
    ("summarisation", SUMMARISATION),
    ("code_explanation", CODE_EXPLANATION),
    ("creative_writing", CREATIVE_WRITING),
]:
    assert len(_prompts) == 12, f"{_domain} has {len(_prompts)} prompts, expected 12"
    for _i, _p in enumerate(_prompts):
        PROMPT_CORPUS.append({"id": f"{_domain}_{_i+1:02d}", "domain": _domain, "text": _p})

assert len(PROMPT_CORPUS) == 60

# Flat text list, in corpus order, for callers that only need prompt text
DEFAULT_PROMPTS = [p["text"] for p in PROMPT_CORPUS]
