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
        switch (process.platform) {
            case "win32":
                return acquireNJWindows(version);
            case "linux":
                return acquireNJLinux(version);
            case "darwin":
                return acquireNJMacOS(version);
            default:
                throw `Unknown platform: ${process.platform}`;
        }
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
            core.debug(error);
            throw `Failed to download version ${version}: ${error}`;
        }
        yield exec.exec("msiexec", ["/qn", "/i", downloadPath]);
        return Promise.resolve(path.join("C:", "Program Files (x86)", "SMLNJ"));
    });
}
function defaultBits(version) {
    return semver.satisfies(format(version), ">=110.98") ? 64 : 32;
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
        return acquireNJUnix(version);
    });
}
function acquireNJUnix(version) {
    return __awaiter(this, void 0, void 0, function* () {
        let downloadUrl = util.format("http://smlnj.cs.uchicago.edu/dist/working/%s/config.tgz", version);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            core.debug(error);
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
function acquireNJMacOS(version) {
    return __awaiter(this, void 0, void 0, function* () {
        let architecture = defaultBits(version) == 32 ? "x86" : "amd64";
        let downloadUrl = util.format("https://smlnj.org/dist/working/%s/smlnj-%s-%s.pkg", version, architecture, version);
        core.debug("Downloading SML/NJ from: " + downloadUrl);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            core.debug(error);
            throw `Failed to download version ${version}: ${error}`;
        }
        yield exec.exec("sudo", ["installer", "-pkg", downloadPath, "-target", "/"]);
        return Promise.resolve(path.join(path.sep, "usr", "local", "smlnj"));
    });
}
