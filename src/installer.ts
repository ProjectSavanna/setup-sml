import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as semver from "semver";
import * as path from "path";
import * as util from "util";
import { chdir } from "process";

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
  if (semver.satisfies(format(version), ">=2023"))
    return acquireNJGitHub(version)

  switch (process.platform) {
    case "win32":
      return acquireNJWindows(version);
    case "darwin":
      return acquireNJMacOS(version);
    case "linux":
      return acquireNJLinux(version);
    default:
      throw `Unknown platform: ${process.platform}`;
  }
}


function defaultBits(version: string): 32 | 64 {
  return semver.satisfies(format(version), ">=110.98") ? 64 : 32;
}

function getArchitecture(version: string, armAllowed: boolean = false): string {
  switch (process.platform) {
    case "darwin":
      return defaultBits(version) == 32 ? "x86" :
        armAllowed && process.arch.startsWith("arm") ? "arm64" : "amd64";
    case "linux":
      return "amd64";
    default:
      throw `Unknown architecture for platform ${process.platform}`;
  }
}


async function acquireNJGitHub(version: string): Promise<string> {
  await exec.exec("git", ["clone", "--depth", "1", "--branch", "v" + version, "--recurse-submodules", "https://github.com/smlnj/smlnj.git"]);

  let filename: string = util.format("boot.%s-unix.tgz", getArchitecture(version, true))
  core.debug(`Downloading file: ${filename}`)

  let downloadUrl: string = util.format(
    "https://smlnj.org/dist/working/%s/%s",
    version,
    filename
  );

  core.debug("Downloading SML/NJ from: " + downloadUrl);

  try {
    await tc.downloadTool(downloadUrl, path.join("smlnj", filename));
  } catch (error) {
    let message = 'Unknown Error';
    if (error instanceof Error) message = error.message;
    core.debug(message);

    throw `Failed to download version ${version}: ${error}`;
  }

  await exec.exec("./build.sh", [], { cwd: "smlnj" });

  return await tc.cacheDir("smlnj", "smlnj", format(version));
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
    let message = 'Unknown Error';
    if (error instanceof Error) message = error.message;
    core.debug(message);

    throw `Failed to download version ${version}: ${error}`;
  }

  await exec.exec("msiexec", ["/qn", "/i", downloadPath]);
  return Promise.resolve(path.join("C:", "Program Files (x86)", "SMLNJ"));
}


async function acquireNJMacOS(version: string): Promise<string> {
  let architecture = getArchitecture(version);

  let filename: string = util.format("smlnj-%s-%s.pkg", architecture, version);
  let downloadUrl: string = util.format(
    "https://smlnj.org/dist/working/%s/%s",
    version,
    filename
  );

  core.debug("Downloading SML/NJ from: " + downloadUrl);

  let runnerTemp: string = process.env['RUNNER_TEMP'] || '';

  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl, path.join(runnerTemp, filename));
  } catch (error) {
    let message = 'Unknown Error';
    if (error instanceof Error) message = error.message;
    core.debug(message);

    throw `Failed to download version ${version}: ${error}`;
  }

  await exec.exec("sudo", ["installer", "-pkg", downloadPath, "-target", "/"]);
  return Promise.resolve(path.join(path.sep, "usr", "local", "smlnj"));
}

async function acquireNJLinux(version: string): Promise<string> {
  if (defaultBits(version) == 32) {
    // install 32-bit support libraries
    await exec.exec("sudo", ["dpkg", "--add-architecture", "i386"]);
    await exec.exec("sudo", ["apt-get", "update"]);
    await exec.exec("sudo", ["apt-get", "install", "libc6:i386"]);
    await exec.exec("sudo", [
      "apt-get",
      "install",
      "-y",
      "--no-install-recommends",
      "gcc-multilib",
      "g++-multilib"
    ]);
  }

  let downloadUrl: string = util.format(
    "http://smlnj.cs.uchicago.edu/dist/working/%s/config.tgz",
    version
  );

  core.debug("Downloading SML/NJ from: " + downloadUrl);

  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    let message = 'Unknown Error';
    if (error instanceof Error) message = error.message;
    core.debug(message);

    throw `Failed to download version ${version}: ${error}`;
  }

  let extPath = await tc.extractTar(downloadPath);

  await exec.exec(path.join("config", "install.sh"), [], { cwd: extPath });

  return await tc.cacheDir(extPath, "smlnj", format(version));
}

function format(version: string): string {
  let result: string | null = semver.valid(semver.coerce(version));
  if (result == null) {
    core.debug(`Unable to coerce to a valid semver: ${version}`);
    throw `Unable to coerce to a valid semver: ${version}`;
  }
  return result;
}
