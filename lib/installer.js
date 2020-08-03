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
        switch (version) {
            case "win32":
                return acquireNJWindows(version);
            case "linux":
                return acquireNJLinux(version);
            default:
                return acquireNJUnix(version);
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
        return new Promise((resolve, _) => resolve(path.join("C:", "Program Files (x86)", "SMLNJ")));
    });
}
function acquireNJLinux(version) {
    return __awaiter(this, void 0, void 0, function* () {
        // install required 32-bit support libraries
        yield exec.exec("sudo", ["apt-get", "update"]);
        yield exec.exec("sudo", [
            "apt-get",
            "install",
            "-y",
            "--no-install-recommends",
            "gcc-multilib",
            "lib32ncurses5",
            "lib32z1"
        ]);
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
const format = (version) => version + ".0";
