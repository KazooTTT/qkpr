import { getCustomBranchNamePrompt, getCustomCommitMessagePrompt, getPromptLanguage } from '../utils/config'
import { locales } from './locales'

const lang = getPromptLanguage()

export const COMMIT_MESSAGE_PROMPT = getCustomCommitMessagePrompt() || locales[lang].COMMIT_MESSAGE_PROMPT
export const BRANCH_NAME_PROMPT = getCustomBranchNamePrompt() || locales[lang].BRANCH_NAME_PROMPT
