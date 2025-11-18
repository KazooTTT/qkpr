# Scripts

## fetch-gemini-models.js

Fetches the latest available Gemini models from Google's API.

### Usage

```bash
QUICK_PR_GEMINI_API_KEY=your_api_key node scripts/fetch-gemini-models.js
# or use the legacy variable name
GEMINI_API_KEY=your_api_key node scripts/fetch-gemini-models.js
```

Or if you have the key in your environment:

```bash
node scripts/fetch-gemini-models.js
```

### Output

The script will:
1. Fetch all models that support `generateContent` method
2. Group them by version (2.5, 2.0, 1.5, etc.)
3. Output formatted code ready to copy into `src/services/commit.ts`
4. Show the current date for tracking updates

### When to Run

Run this script when:
- You want to update the available models list
- Google releases new Gemini models
- You need to verify which models are currently available

### After Running

1. Copy the generated model list
2. Update `getCommonModels()` in `src/services/commit.ts`
3. Update the "Last updated" comment with the new date
4. Update the model count in the comment
5. Update `README.md` if there are significant changes
6. Run `pnpm run build` to verify
