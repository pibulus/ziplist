import { promptTemplates, applyTemplate } from "./promptTemplates.js";

export const promptManager = {
  getPrompt: (operation, variables = {}) => {
    const entry = promptTemplates.standard[operation];
    if (!entry) {
      throw new Error(`Unknown prompt operation '${operation}'`);
    }
    return applyTemplate(entry.text, variables);
  },
};
