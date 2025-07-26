name: "Base PRP Template v2 - Context-Rich with Validation Loops"
description: |

## Purpose

Template optimized for AI agents to implement features with sufficient context and self-validation capabilities to achieve working code through iterative refinement.

## Core Principles

1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance

---

## Goal

There is a current project existing within this structure, this project JCESPORTS-EXPRESSJS (app.js) is an application I've been working on. I need help completing this application using the existing structure. I've received a list of things to update from the stakeholder and they need implemented. Additionally, I need to fix the website and make it pleasing UI/UX using the current system. Some pages don't have content on them. Let's fill it with a creative design with sample content that matches the theme of the page.

Landing Page:
- Pulled insporation from other esports websites
Theme: gold Hex #a19468, blue hex #061945, and white #fdfdfd

About Page
1. Sponsors page (organizations that want to support our esports program through external donation. This is where we'll highlight our sponsors and show them proudly.)
- Contact Page (Create a sample contact page with a sample number to dial to reach the program), make this page personalized too
- Donate Button (unsure where this leads to right now.)

2. Staff Page
- Image of each staff member
- hover over image for name, year, and position
- on click will bring you to a page on how to contact each staff member, brief "about staff" excerpt.

3. Team Page pull inspo from https://www.juniatasports.net/landing/index
- Nav bar with each team under "SPORT"
- Carosel of people playing / team images.
  - When click on team, display team roster
  * Roster must include player name, gamer tag, year, position (in the game), jeresey number. When an individual player is selected: have short exercpt of the player, name, year, years played and important stats.

4. Schedule Page
- Calendar of the month
  - Display game days / watch parties / etc.
- Try out schedule (so people know when we host tryouts)

5. Awards Page
- Display all award titles | conference | team using this reference for the page layout https://esportsta.org/industry-awards/

6. Program History Page
- Insert information about the program

7. Alumni Page
- In this page, showcase pictures of our alumni and reunions together. for this use sample photos but make it wholesome in design.


Notes:
Try to incorporate motion design and or videos within the website. Either the background or as an add. Use a template for the UI/UX to have our logo faded in the back on some pages. Use different shapes and make it looks seamless.


## Why

- I'm creating a website for Juniata College's Esports Program. By students, for students.

## What

Create a backend admin dashboard that can be access to add and remove calendar invites dynamically. This would hook and be saved within my dynamodb database. In the admin dashboard have a section for managing user roles, admin or user or super admin. Super admin can change all roles but admin cannot change super admin and user is the lowest tier. Add CRUD for being able to modify the images on the different pages dynamically without adjust the code. The files will be stored in the system so if you can read the file after upload and then use it. Secondly, CRUD for adjusting the team roster. Follow the current dynamo table format located within Claude.MD.

### Success Criteria

- [ ] [Specific measurable outcomes]

## All Needed Context

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase

```bash

```

### Desired Codebase tree with files to be added and responsibility of file

```bash

```

### Known Gotchas of our codebase & Library Quirks

```python
# CRITICAL: [Library name] requires [specific setup]
# Example: FastAPI requires async functions for endpoints
# Example: This ORM doesn't support batch inserts over 1000 records
# Example: We use pydantic v2 and
```

## Implementation Blueprint

### Data models and structure

Create the core data models, we ensure type safety and consistency.

```python
Examples:
 - orm models
 - pydantic models
 - pydantic schemas
 - pydantic validators

```

### List of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1:
MODIFY src/existing_module.py:
  - FIND pattern: "class OldImplementation"
  - INJECT after line containing "def __init__"
  - PRESERVE existing method signatures

CREATE src/new_feature.py:
  - MIRROR pattern from: src/similar_feature.py
  - MODIFY class name and core logic
  - KEEP error handling pattern identical

...(...)

Task N:
...

```

### Per task pseudocode as needed added to each task

```python

# Task 1
# Pseudocode with CRITICAL details don't write entire code
async def new_feature(param: str) -> Result:
    # PATTERN: Always validate input first (see src/validators.py)
    validated = validate_input(param)  # raises ValidationError

    # GOTCHA: This library requires connection pooling
    async with get_connection() as conn:  # see src/db/pool.py
        # PATTERN: Use existing retry decorator
        @retry(attempts=3, backoff=exponential)
        async def _inner():
            # CRITICAL: API returns 429 if >10 req/sec
            await rate_limiter.acquire()
            return await external_api.call(validated)

        result = await _inner()

    # PATTERN: Standardized response format
    return format_response(result)  # see src/utils/responses.py
```

### Integration Points

```yaml
DATABASE:
  - migration: "Add column 'feature_enabled' to users table"
  - index: "CREATE INDEX idx_feature_lookup ON users(feature_id)"

CONFIG:
  - add to: config/settings.py
  - pattern: "FEATURE_TIMEOUT = int(os.getenv('FEATURE_TIMEOUT', '30'))"

ROUTES:
  - add to: src/api/routes.py
  - pattern: "router.include_router(feature_router, prefix='/feature')"
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST - fix any errors before proceeding
ruff check src/new_feature.py --fix  # Auto-fix what's possible
mypy src/new_feature.py              # Type checking

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns

```python
# CREATE test_new_feature.py with these test cases:
def test_happy_path():
    """Basic functionality works"""
    result = new_feature("valid_input")
    assert result.status == "success"

def test_validation_error():
    """Invalid input raises ValidationError"""
    with pytest.raises(ValidationError):
        new_feature("")

def test_external_api_timeout():
    """Handles timeouts gracefully"""
    with mock.patch('external_api.call', side_effect=TimeoutError):
        result = new_feature("valid")
        assert result.status == "error"
        assert "timeout" in result.message
```

```bash
# Run and iterate until passing:
uv run pytest test_new_feature.py -v
# If failing: Read error, understand root cause, fix code, re-run (never mock to pass)
```

### Level 3: Integration Test

```bash
# Start the service
uv run python -m src.main --dev

# Test the endpoint
curl -X POST http://localhost:8000/feature \
  -H "Content-Type: application/json" \
  -d '{"param": "test_value"}'

# Expected: {"status": "success", "data": {...}}
# If error: Check logs at logs/app.log for stack trace
```

### Level 4: Deployment & Creative Validation

```bash
# MCP servers or other creative validation methods
# Examples:
# - Load testing with realistic data
# - End-to-end user journey testing
# - Performance benchmarking
# - Security scanning
# - Documentation validation

# Custom validation specific to the feature
# [Add creative validation methods here]
```

## Final validation Checklist

- [ ] All tests pass: `uv run pytest tests/ -v`
- [ ] No linting errors: `uv run ruff check src/`
- [ ] No type errors: `uv run mypy src/`
- [ ] Manual test successful: [specific curl/command]
- [ ] Error cases handled gracefully
- [ ] Logs are informative but not verbose
- [ ] Documentation updated if needed

---

## Anti-Patterns to Avoid

- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"
- ❌ Don't ignore failing tests - fix them
- ❌ Don't use sync functions in async context
- ❌ Don't hardcode values that should be config
- ❌ Don't catch all exceptions - be specific
