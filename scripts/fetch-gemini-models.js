/**
 * Fetch latest Gemini models from Google API
 * Usage: GEMINI_API_KEY=your_key node scripts/fetch-gemini-models.js
 *
 * This script fetches all models that support 'generateContent' method
 * and outputs them in a format ready to be copied to src/services/commit.ts
 */

const apiKey = process.env.QUICK_PR_GEMINI_API_KEY || process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('❌ QUICK_PR_GEMINI_API_KEY or GEMINI_API_KEY not found in environment')
  console.error('Usage: QUICK_PR_GEMINI_API_KEY=your_key node scripts/fetch-gemini-models.js')
  console.error('   or: GEMINI_API_KEY=your_key node scripts/fetch-gemini-models.js')
  process.exit(1)
}

console.log('🔍 Fetching models from Google Gemini API...\n')

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  })
  .then((data) => {
    // Filter models that support generateContent
    const models = data.models
      .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
      .map(model => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName,
        description: model.description,
      }))

    console.log(`✅ Found ${models.length} models that support generateContent\n`)

    // Group by version
    const gemini25 = models.filter(m => m.name.startsWith('gemini-2.5'))
    const gemini20 = models.filter(m => m.name.startsWith('gemini-2.0'))
    const gemini15 = models.filter(m => m.name.startsWith('gemini-1.5') || m.name.startsWith('gemini-1.0'))
    const aliases = models.filter(m => m.name.includes('-latest'))
    const gemma = models.filter(m => m.name.startsWith('gemma'))
    const others = models.filter(m =>
      !m.name.startsWith('gemini-')
      && !m.name.startsWith('gemma')
      && !m.name.includes('-latest'),
    )

    console.log('📋 Model names (ready to copy to getCommonModels()):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (gemini25.length > 0) {
      console.log('    // Gemini 2.5 Models (Latest)')
      gemini25.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    if (gemini20.length > 0) {
      console.log('    // Gemini 2.0 Models')
      gemini20.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    if (gemini15.length > 0) {
      console.log('    // Gemini 1.5 Models')
      gemini15.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    if (aliases.length > 0) {
      console.log('    // Latest Aliases')
      aliases.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    if (others.length > 0) {
      console.log('    // Experimental Models')
      others.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    if (gemma.length > 0) {
      console.log('    // Gemma Models')
      gemma.forEach(m => console.log(`    '${m.name}',`))
      console.log('')
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Output JSON for detailed info
    console.log('📄 Full model list (JSON):')
    console.log(JSON.stringify(models.map(m => m.name), null, 2))

    console.log(`\n✨ Last updated: ${new Date().toISOString().split('T')[0]}`)
  })
  .catch((error) => {
    console.error('❌ Error fetching models:', error.message)
    process.exit(1)
  })
