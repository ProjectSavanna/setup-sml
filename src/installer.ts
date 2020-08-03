import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as path from "path";
import * as util from "util";

export async function getNJ(version: string) {
  // check cache
  let toolPath: string;
  toolPath = tc.find("smlnj", format(version));

  // download if not cached
  if (!toolPath) {
    toolPath = await acquireNJ(version);
    core.debug("SML/NJ is cached under " + toolPath);
  }

  // add bin to path
  core.addPath(path.join(toolPath, "bin"));
}

async function acquireNJ(version: string): Promise<string> {
  switch (version) {
    case "win32":
      return acquireNJWindows(version);
    case "linux":
      return acquireNJLinux(version);
    default:
      return acquireNJUnix(version);
  }
}

async function acquireNJWindows(version: string): Promise<string> {
  let downloadUrl: string = util.format(
    "https://smlnj.org/dist/working/%s/smlnj-%s.msi",
    version,
    version
  );

  core.debug("Downloading SML/NJ from: " + downloadUrl);

  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  await exec.exec("msiexec", ["/qn", "/i", downloadPath]);
  return new Promise((resolve, _) =>
    resolve(path.join("C:", "Program Files (x86)", "SMLNJ"))
  );
}

async function acquireNJLinux(version: string): Promise<string> {
  // install required 32-bit support libraries
  await exec.exec("sudo", ["apt-get", "update"]);
  await exec.exec("sudo", [
    "apt-get",
    "install",
    "-y",
    "--no-install-recommends",
    "gcc-multilib",
    "lib32ncurses5",
    "lib32z1"
  ]);

  return acquireNJUnix(version);
}

async function acquireNJUnix(version: string): Promise<string> {
  let downloadUrl: string = util.format(
    "http://smlnj.cs.uchicago.edu/dist/working/%s/config.tgz",
    version
  );

  core.debug("Downloading SML/NJ from: " + downloadUrl);

  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  let extPath = await tc.extractTar(downloadPath);

  await exec.exec(path.join("config", "install.sh"), [], { cwd: extPath });

  return await tc.cacheDir(extPath, "smlnj", format(version));
}

const format = (version: string) => version + ".0";
