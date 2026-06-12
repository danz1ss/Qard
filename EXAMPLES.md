# AnkiGenerator Usage Examples

This document provides examples and best practices for using AnkiGenerator.

## Quick Start Example

### Step 1: Setup

1. Start Anki and ensure it's running
2. Open AnkiGenerator
3. In the **Setup** tab:
   - Enter your Gemini API key: `AIza...`
   - Select deck: `English Vocabulary`
   - Select model: `Basic`
   - Set example count: `3`

4. Configure field mapping:
   - **Front** → Word
   - **Back** → Translation

5. Click "Save Settings"

### Step 2: Input Words

Go to the **Input** tab and enter:

```
hello
world
computer
language
practice
```

Click "Parse Words" - you should see 5 words.

### Step 3: Generate

1. Go to the **Generate** tab
2. Review the settings summary
3. Click "Start Generation"
4. Wait for completion (about 30-60 seconds per word)

### Step 4: Review & Add

1. Go to the **Preview** tab
2. Click on each card to review
3. Play audio to test pronunciation
4. Click "Add All to Anki"
5. Open Anki to see your new cards!

## Field Mapping Scenarios

### Scenario 1: Minimal Setup (Basic Model)

**Model Fields**: Front, Back

**Mapping**:
- Front → Word
- Back → Translation

**Result**: Simple flashcards with just the word and its translation.

### Scenario 2: Standard Vocabulary (Custom Model)

Create an Anki model with fields: Word, Translation, Transcription, Audio

**Mapping**:
- Word → Word
- Translation → Translation
- Transcription → Transcription
- Audio → Audio

**Result**: Complete vocabulary cards with pronunciation guide and audio.

### Scenario 3: Full-Featured (Advanced Model)

Create an Anki model with fields:
- English
- Russian
- IPA
- Examples_EN
- Examples_RU
- Pronunciation

**Mapping**:
- English → Word
- Russian → Translation
- IPA → Transcription
- Examples_EN → Examples
- Examples_RU → ExampleTranslations
- Pronunciation → Audio

**Result**: Comprehensive cards with all available information.

### Scenario 4: Context-Focused

**Model Fields**: Word, Meaning, Context, Sound

**Mapping**:
- Word → Word
- Meaning → Translation
- Context → Examples (combines English examples)
- Sound → Audio

**Result**: Cards emphasizing contextual usage.

## Word List Templates

### Basic Words
```
hello
goodbye
please
thank you
yes
no
```

### Themed Vocabulary: Travel

```
airport
ticket
hotel
reservation
passport
luggage
departure
arrival
```

### Phrasal Verbs

```
look up
give up
take off
put on
turn off
turn on
```

### Business Vocabulary

```
meeting
presentation
deadline
project
schedule
budget
revenue
```

## Tips for Best Results

### 1. Word Selection

**DO**:
- Use single words or common phrases
- Keep words in base form (infinitive for verbs)
- Use lowercase

**DON'T**:
- Mix multiple languages
- Include very long phrases (>3 words)
- Use slang or very informal language

### 2. Example Count

- **1 example**: Quick basic cards
- **2-3 examples**: Recommended for most cases
- **4-5 examples**: Comprehensive learning, but longer generation time

### 3. Batch Size

For optimal performance:
- **Small batch (1-10 words)**: Quick testing, immediate results
- **Medium batch (11-50 words)**: Daily vocabulary addition
- **Large batch (51-100 words)**: Weekly study preparation

Note: API rate limits may apply for very large batches.

### 4. Field Mapping Strategy

**Minimalist Approach** (Basic model):
- Fast to create
- Easy to review
- Good for passive recognition

**Comprehensive Approach** (Custom model with all fields):
- More information per card
- Better for active production
- Requires more review time

**Balanced Approach** (Word + Translation + Audio):
- Quick to review
- Includes pronunciation
- Good for most learners

## Common Workflows

### Workflow 1: Daily Vocabulary Builder

1. Keep a running list of new words you encounter
2. Once per day, add 5-10 words
3. Generate and review
4. Add to Anki before evening review session

### Workflow 2: Themed Study Sessions

1. Choose a theme (e.g., "Kitchen", "Office", "Sports")
2. Add 15-20 related words
3. Generate all at once
4. Study as a thematic deck in Anki

### Workflow 3: Book/Article Vocabulary

1. While reading, collect unfamiliar words
2. Add them to a text file
3. Copy/paste into AnkiGenerator
4. Generate and add to a dedicated deck

## Troubleshooting Examples

### Example 1: Audio Not Playing in Anki

**Problem**: Audio field shows `[sound:word_123.mp3]` but doesn't play

**Solution**:
1. Check that Audio field is mapped correctly
2. Verify the field type in Anki is set to allow media
3. Try playing the audio in Preview tab first

### Example 2: Examples Too Simple/Complex

**Problem**: Generated examples don't match your level

**Current limitation**: The Gemini prompt uses general difficulty
**Workaround**: Review in Preview tab and remove unsuitable cards

### Example 3: Translation Not Accurate

**Problem**: Some translations seem off

**Solution**:
1. Review all cards in Preview tab before adding
2. Remove incorrect cards
3. Manually edit in Anki after import
4. Consider regenerating specific words

## Advanced Configuration

### Deck Organization

Create separate decks for:
- Frequency levels (Common, Intermediate, Advanced)
- Topics (Travel, Business, Academic)
- Learning stage (New, Review, Mastered)

### Model Templates

Recommended card template (HTML) for custom model:

**Front Template**:
```html
<div class="word">{{Word}}</div>
{{#Transcription}}
<div class="transcription">{{Transcription}}</div>
{{/Transcription}}
```

**Back Template**:
```html
{{FrontSide}}
<hr>
<div class="translation">{{Translation}}</div>
{{#Examples}}
<div class="examples">{{Examples}}</div>
{{/Examples}}
{{#Audio}}
{{Audio}}
{{/Audio}}
```

## Best Practices Summary

1. **Start Small**: Test with 3-5 words first
2. **Save Settings**: Always save after configuring
3. **Review Before Adding**: Check all cards in Preview tab
4. **Consistent Naming**: Use clear deck names
5. **Regular Backups**: Export your Anki decks regularly
6. **Monitor API Usage**: Check your API quotas periodically

## Example Session Timeline

**Total time: ~15 minutes for 10 words**

- 0:00 - Open AnkiGenerator
- 0:30 - Check Anki connection
- 1:00 - Enter 10 words in Input tab
- 1:30 - Click "Parse Words"
- 2:00 - Go to Generate tab
- 2:30 - Start generation
- 7:30 - Generation complete (5 minutes for 10 words)
- 8:00 - Review cards in Preview tab
- 12:00 - Remove any problematic cards
- 12:30 - Add all to Anki
- 13:00 - Verify in Anki
- 15:00 - Ready to study!

## Next Steps

After mastering the basics:
1. Experiment with different field mappings
2. Create themed vocabulary decks
3. Integrate into your daily study routine
4. Share your custom model templates with the community

Happy learning! 🎓
