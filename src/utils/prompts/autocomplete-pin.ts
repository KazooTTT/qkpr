import ansiEscapes from 'ansi-escapes'
import figures from 'figures'
import Choices from 'inquirer/lib/objects/choices.js'
import Base from 'inquirer/lib/prompts/base.js'
import observe from 'inquirer/lib/utils/events.js'
import Paginator from 'inquirer/lib/utils/paginator.js'
import * as utils from 'inquirer/lib/utils/readline.js'
import { cyan, dim, red, yellow } from 'kolorist'
import runAsync from 'run-async'
import { takeWhile } from 'rxjs'

function isSelectable(choice: any): boolean {
  return choice.type !== 'separator' && !choice.disabled
}

class AutocompletePinPrompt extends Base {
  currentChoices: any
  firstRender: boolean
  selected: number
  initialValue: any
  paginator: any
  searchedOnce: boolean | undefined
  searching: boolean | undefined
  lastSearchTerm: string | undefined
  lastPromise: Promise<any> | undefined
  nbChoices: number | undefined
  done: any
  answer: any
  answerName: any
  shortAnswer: any

  constructor(
    questions: any,
    rl: any,
    answers: any,
  ) {
    super(questions, rl, answers)

    const opt = this.opt as any

    if (!opt.source) {
      this.throwParamError('source')
    }

    this.currentChoices = new Choices([], answers)

    this.firstRender = true
    this.selected = 0

    // Make sure no default is set (so it won't be printed)
    this.initialValue = opt.default
    if (!opt.suggestOnly) {
      opt.default = null
    }

    const shouldLoop = opt.loop === undefined ? true : opt.loop
    this.paginator = new Paginator(this.screen, {
      isInfinite: shouldLoop,
    })
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */
  _run(cb: any): this {
    this.done = cb

    // @ts-expect-error - history is not in types but exists at runtime
    if (Array.isArray(this.rl.history)) {
      // @ts-expect-error - history is not in types but exists at runtime
      this.rl.history = []
    }

    const events = observe(this.rl)

    const dontHaveAnswer = (): boolean => this.answer === undefined

    events.line
      .pipe(takeWhile(dontHaveAnswer))
      .forEach(this.onSubmit.bind(this))
    events.keypress
      .pipe(takeWhile(dontHaveAnswer))
      .forEach(this.onKeypress.bind(this))

    // Call once at init
    this.search(undefined)

    return this
  }

  /**
   * Render the prompt to screen
   * @return {undefined}
   */
  render(error?: string): void {
    // Render question
    let content = this.getQuestion()
    let bottomContent = ''
    const opt = this.opt as any

    // Always show help hint
    const suggestText = opt.suggestOnly ? ', tab to autocomplete' : ''
    content += dim(
      `(Use arrow keys or type to search${suggestText}, Ctrl+P to Pin)`,
    )

    // Render choices or answer depending on the state
    if (this.status === 'answered') {
      content += cyan(this.shortAnswer || this.answerName || this.answer)
    }
    else if (this.searching) {
      content += this.rl.line
      bottomContent += `  ${dim(opt.searchText || 'Searching...')}`
    }
    else if (this.nbChoices) {
      const choicesStr = listRender(this.currentChoices, this.selected)
      content += this.rl.line
      const indexPosition = this.selected
      let realIndexPosition = 0
      this.currentChoices.choices.every((choice: any, index: number) => {
        if (index > indexPosition) {
          return false
        }
        const name = choice.name
        realIndexPosition += name ? name.split('\n').length : 0
        return true
      })
      bottomContent += this.paginator.paginate(
        choicesStr,
        realIndexPosition,
        opt.pageSize,
      )
    }
    else {
      content += this.rl.line
      bottomContent += `  ${yellow(opt.emptyText || 'No results...')}`
    }

    if (error) {
      bottomContent += `\n${red('>> ')}${error}`
    }

    this.firstRender = false

    this.screen.render(content, bottomContent)
  }

  /**
   * When user press `enter` key
   */
  onSubmit(line: string): void {
    let lineOrRl = line || this.rl.line
    const opt = this.opt as any

    // only set default when suggestOnly (behaving as input prompt)
    // list prompt does only set default if matching actual item in list
    if (opt.suggestOnly && !lineOrRl) {
      lineOrRl = opt.default === null ? '' : opt.default
    }

    if (typeof opt.validate === 'function') {
      const checkValidationResult = (validationResult: any): void => {
        if (validationResult !== true) {
          this.render(
            validationResult || 'Enter something, tab to autocomplete!',
          )
        }
        else {
          this.onSubmitAfterValidation(lineOrRl)
        }
      }

      let validationResult
      if (opt.suggestOnly) {
        validationResult = opt.validate(lineOrRl, this.answers)
      }
      else {
        const choice = this.currentChoices.getChoice(this.selected)
        validationResult = opt.validate(choice, this.answers)
      }

      if (isPromise(validationResult)) {
        validationResult.then(checkValidationResult)
      }
      else {
        checkValidationResult(validationResult)
      }
    }
    else {
      this.onSubmitAfterValidation(lineOrRl)
    }
  }

  onSubmitAfterValidation(line: string): void {
    const opt = this.opt as any
    let choice: any = {}
    if (this.nbChoices && this.nbChoices <= this.selected && !opt.suggestOnly) {
      this.rl.write(line)
      this.search(line)
      return
    }

    if (opt.suggestOnly) {
      choice.value = line || this.rl.line
      this.answer = line || this.rl.line
      this.answerName = line || this.rl.line
      this.shortAnswer = line || this.rl.line
      // @ts-expect-error - line is readonly in types
      this.rl.line = ''
    }
    else if (this.nbChoices) {
      choice = this.currentChoices.getChoice(this.selected)
      this.answer = choice.value
      this.answerName = choice.name
      this.shortAnswer = choice.short
    }
    else {
      this.rl.write(line)
      this.search(line)
      return
    }

    // @ts-expect-error - runAsync signature doesn't match exactly
    runAsync(opt.filter, (_err: any, value: any) => {
      choice.value = value
      this.answer = value

      if (opt.suggestOnly) {
        this.shortAnswer = value
      }

      this.status = 'answered'
      // Rerender prompt
      this.render()
      this.screen.done()
      this.done(choice.value)
    })(choice.value)
  }

  search(searchTerm: string | undefined): Promise<any> {
    const opt = this.opt as any

    // Capture current selection before reset
    let currentValue: any
    if (this.currentChoices && this.nbChoices && this.nbChoices > this.selected) {
      const currentChoice = this.currentChoices.getChoice(this.selected)
      if (currentChoice) {
        currentValue = currentChoice.value
      }
    }

    this.selected = 0

    // Only render searching state after first time
    if (this.searchedOnce) {
      this.searching = true
      this.currentChoices = new Choices([], this.answers)
      this.render() // Now render current searching state
    }
    else {
      this.searchedOnce = true
    }

    this.lastSearchTerm = searchTerm

    let thisPromise: Promise<any>
    try {
      const result = opt.source(this.answers, searchTerm)
      thisPromise = Promise.resolve(result)
    }
    catch (error) {
      thisPromise = Promise.reject(error)
    }

    // Store this promise for check in the callback
    this.lastPromise = thisPromise

    return thisPromise.then((choices) => {
      // If another search is triggered before the current search finishes, don't set results
      if (thisPromise !== this.lastPromise)
        return

      this.currentChoices = new Choices(choices, this.answers)

      const realChoices = choices.filter((choice: any) => isSelectable(choice))
      this.nbChoices = realChoices.length

      let selectedIndex = -1

      // Try to restore selection by value
      if (currentValue !== undefined) {
        selectedIndex = realChoices.findIndex(
          (choice: any) => choice === currentValue || choice.value === currentValue,
        )
      }

      // Fallback to initial value if not found
      if (selectedIndex === -1) {
        selectedIndex = realChoices.findIndex(
          (choice: any) =>
            choice === this.initialValue || choice.value === this.initialValue,
        )
      }

      if (selectedIndex >= 0) {
        this.selected = selectedIndex
      }

      this.searching = false
      this.render()
    })
  }

  ensureSelectedInRange(): void {
    // @ts-expect-error - nbChoices is number
    const selectedIndex = Math.min(this.selected, this.nbChoices) // Not above currentChoices length - 1
    this.selected = Math.max(selectedIndex, 0) // Not below 0
  }

  /**
   * When user type
   */

  onKeypress(e: any): void {
    const opt = this.opt as any
    let len
    const keyName = (e.key && e.key.name) || undefined

    // Handle Ctrl+P for PIN action
    if (keyName === 'p' && e.key.ctrl) {
      if (this.nbChoices && opt.onPin) {
        const choice = this.currentChoices.getChoice(this.selected)
        if (choice) {
          // Execute callback
          Promise.resolve(opt.onPin(choice.value, choice)).then(() => {
            // Refresh list keeping search term
            this.search(this.rl.line)
          })
        }
      }
      return
    }

    if (keyName === 'tab' && opt.suggestOnly) {
      if (this.currentChoices.getChoice(this.selected)) {
        this.rl.write(ansiEscapes.cursorLeft)
        const autoCompleted = this.currentChoices.getChoice(
          this.selected,
        ).value
        this.rl.write(ansiEscapes.cursorForward(autoCompleted.length))
        // @ts-expect-error - line is readonly in types
        this.rl.line = autoCompleted
        this.render()
      }
    }
    else if (keyName === 'down' || (keyName === 'n' && e.key.ctrl)) {
      len = this.nbChoices
      // @ts-expect-error - len is number
      this.selected = this.selected < len - 1 ? this.selected + 1 : 0
      this.ensureSelectedInRange()
      this.render()
      utils.up(this.rl, 2)
    }
    else if (keyName === 'up') { // Removed Ctrl+P from here
      len = this.nbChoices
      // @ts-expect-error - len is number
      this.selected = this.selected > 0 ? this.selected - 1 : len - 1
      this.ensureSelectedInRange()
      this.render()
    }
    else {
      this.render() // Render input automatically
      // Only search if input have actually changed, not because of other keypresses
      if (this.lastSearchTerm !== this.rl.line) {
        this.search(this.rl.line) // Trigger new search
      }
    }
  }
}

/**
 * Function for rendering list choices
 * @param  {any} choices The choices to render
 * @param  {number} pointer Position of the pointer
 * @return {string}         Rendered content
 */
function listRender(choices: any, pointer: number): string {
  let output = ''
  let separatorOffset = 0

  choices.forEach((choice: any, i: number) => {
    if (choice.type === 'separator') {
      separatorOffset++
      output += `  ${choice}\n`
      return
    }

    if (choice.disabled) {
      separatorOffset++
      output += `  - ${choice.name}`
      output
        += ` (${
          typeof choice.disabled === 'string' ? choice.disabled : 'Disabled'
        })`
      output += '\n'
      return
    }

    const isSelected = i - separatorOffset === pointer
    let line = (isSelected ? `${figures.pointer} ` : '  ') + choice.name

    if (isSelected) {
      line = cyan(line)
    }

    output += `${line} \n`
  })

  return output.replace(/\n$/, '')
}

function isPromise(value: any): boolean {
  return typeof value === 'object' && typeof value.then === 'function'
}

export default AutocompletePinPrompt
