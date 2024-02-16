"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const semver = __importStar(require("semver"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
function getNJ(version) {
    return __awaiter(this, void 0, void 0, function* () {
        // check cache
        let toolPath;
        toolPath = tc.find("smlnj", format(version));
        // download if not cached
        if (!toolPath) {
            toolPath = yield acquireNJ(version);
            core.debug("SML/NJ is cached under " + toolPath);
        }
        // add bin to path
        core.addPath(path.join(toolPath, "bin"));
    });
}
exports.getNJ = getNJ;
function acquireNJ(version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (semver.satisfies(format(version), ">=2023"))
            return acquireNJGitHub(version);
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
    });
}
function defaultBits(version) {
    return semver.satisfies(format(version), ">=110.98") ? 64 : 32;
}
function getArchitecture(version, armAllowed = false) {
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
function acquireNJGitHub(version) {
    return __awaiter(this, void 0, void 0, function* () {
        yield exec.exec("git", ["clone", "https://github.com/smlnj/smlnj.git"]);
        console.log(process.platform, process.arch, getArchitecture(version, true));
        let filename = util.format("boot.%s-unix.tgz", getArchitecture(version, true));
        let downloadUrl = util.format("https://smlnj.org/dist/working/%s/%s", version, filename);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        try {
            yield tc.downloadTool(downloadUrl, path.join("smlnj", filename));
        }
        catch (error) {
            let message = 'Unknown Error';
            if (error instanceof Error)
                message = error.message;
            core.debug(message);
            throw `Failed to download version ${version}: ${error}`;
        }
        yield exec.exec("./build.sh", [], { cwd: "smlnj" });
        return yield tc.cacheDir("smlnj", "smlnj", format(version));
    });
}
function acquireNJWindows(version) {
    return __awaiter(this, void 0, void 0, function* () {
        let downloadUrl = util.format("https://smlnj.org/dist/working/%s/smlnj-%s.msi", version, version);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            let message = 'Unknown Error';
            if (error instanceof Error)
                message = error.message;
            core.debug(message);
            throw `Failed to download version ${version}: ${error}`;
        }
        yield exec.exec("msiexec", ["/qn", "/i", downloadPath]);
        return Promise.resolve(path.join("C:", "Program Files (x86)", "SMLNJ"));
    });
}
function acquireNJMacOS(version) {
    return __awaiter(this, void 0, void 0, function* () {
        let architecture = getArchitecture(version);
        let filename = util.format("smlnj-%s-%s.pkg", architecture, version);
        let downloadUrl = util.format("https://smlnj.org/dist/working/%s/%s", version, filename);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        let runnerTemp = process.env['RUNNER_TEMP'] || '';
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl, path.join(runnerTemp, filename));
        }
        catch (error) {
            let message = 'Unknown Error';
            if (error instanceof Error)
                message = error.message;
            core.debug(message);
            throw `Failed to download version ${version}: ${error}`;
        }
        yield exec.exec("sudo", ["installer", "-pkg", downloadPath, "-target", "/"]);
        return Promise.resolve(path.join(path.sep, "usr", "local", "smlnj"));
    });
}
function acquireNJLinux(version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (defaultBits(version) == 32) {
            // install 32-bit support libraries
            yield exec.exec("sudo", ["dpkg", "--add-architecture", "i386"]);
            yield exec.exec("sudo", ["apt-get", "update"]);
            yield exec.exec("sudo", ["apt-get", "install", "libc6:i386"]);
            yield exec.exec("sudo", [
                "apt-get",
                "install",
                "-y",
                "--no-install-recommends",
                "gcc-multilib",
                "g++-multilib"
            ]);
        }
        let downloadUrl = util.format("http://smlnj.cs.uchicago.edu/dist/working/%s/config.tgz", version);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            let message = 'Unknown Error';
            if (error instanceof Error)
                message = error.message;
            core.debug(message);
            throw `Failed to download version ${version}: ${error}`;
        }
        let extPath = yield tc.extractTar(downloadPath);
        yield exec.exec(path.join("config", "install.sh"), [], { cwd: extPath });
        return yield tc.cacheDir(extPath, "smlnj", format(version));
    });
}
function format(version) {
    let result = semver.valid(semver.coerce(version));
    if (result == null) {
        core.debug(`Unable to coerce to a valid semver: ${version}`);
        throw `Unable to coerce to a valid semver: ${version}`;
    }
    return result;
}
