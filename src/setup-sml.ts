import * as core from "@actions/core";
import * as installer from "./installer";

async function run() {
  try {
    let version = core.getInput("smlnj-version");
    await installer.getNJ(version);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
