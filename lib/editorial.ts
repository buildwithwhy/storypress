// Canonical step instructions live in the private Agent Skills packages.
// The app selects the step explicitly; no autonomous agent loop is introduced.
import interviewerInstructions from "../skills/interview-memories/references/interviewer.txt";
export const interviewer = interviewerInstructions.trim();
import researcherInstructions from "../skills/research-story-context/references/search-planner.txt";
export const researcher = researcherInstructions.trim();
import contextualEditorInstructions from "../skills/research-story-context/references/context-editor.txt";
export const contextualEditor = contextualEditorInstructions.trim();
import ghostwriterInstructions from "../skills/write-personal-edition/references/ghostwriter.txt";
export const ghostwriter = ghostwriterInstructions.trim();
