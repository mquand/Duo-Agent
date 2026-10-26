import { LLMProvider } from '../providers/base.js';
import { Plan } from '../types/index.js';

export class ArchitectAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async plan(prompt: string, codeSkeleton: string, projectRules?: string): Promise<Plan> {
    const systemPrompt = `You are a Principal Software System Architect strictly adhering to the PONYTAIL PHILOSOPHY:
"The best code is the code you never wrote."

MANDATORY PONYTAIL PRINCIPLES:
1. YAGNI: Do not over-engineer. Do not create new classes, wrappers, or boilerplate files if modifying 3-5 lines in an existing function achieves the goal.
2. REUSE: Maximize reuse of existing project helpers, libraries, and utilities.
3. MINIMALISM: Break the objective down into the minimum required steps. Each step must have a clear, isolated objective.
4. DAG CONCURRENCY: Explicitly declare "depends_on" between steps. Independent steps (e.g. backend vs frontend, or unrelated modules) MUST have "depends_on": [] to allow parallel execution by worker agents.

OUTPUT FORMAT REQUIREMENTS:
Output raw JSON ONLY (no markdown formatting, no backticks):
{
  "goal": "Concise summary of the high-level objective",
  "summary": "Architectural solution described in 2-3 sentences",
  "dag": [
    {
      "id": "step_1",
      "title": "Short title of the step",
      "target_files": ["path/to/target/file"],
      "instructions": "Precise implementation instructions for Builder: which functions, logic changes, and boundary conditions to handle",
      "depends_on": [],
      "verification_cmd": "Local test or verification command (e.g. npm test, mix test, pytest) if applicable, else empty string"
    }
  ]
}`;

    let userContent = `TASK OBJECTIVE: "${prompt}"\n\n`;

    if (projectRules) {
      userContent += `PROJECT GUIDELINES & RULES:\n${projectRules}\n\n`;
    }

    userContent += `${codeSkeleton}\n\nAnalyze the architecture and return the optimal JSON Plan:`;

    const response = await this.provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { json: true, maxTokens: 4000 }
    );

    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanJson) as Plan;
    } catch (e: any) {
      throw new Error(`Architect returned invalid JSON: ${e.message}\nRaw response: ${response.text.slice(0, 300)}`);
    }
  }
}
