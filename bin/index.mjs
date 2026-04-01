#!/usr/bin/env node

import { runPrompts } from '../src/prompts/index.mjs';
import { resolve } from '../src/engine/dependency.mjs';
import { wire } from '../src/engine/wiring.mjs';
import { generate } from '../src/engine/generator.mjs';
import { banner, success, fail } from '../src/utils/display.mjs';

async function main() {
  banner();

  const answers = await runPrompts();
  const modules = resolve(answers);
  const wired = wire(modules, answers);

  try {
    await generate(wired, answers);
    success(answers.projectName);
  } catch (err) {
    fail(err.message);
    process.exit(1);
  }
}

main();
