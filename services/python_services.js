
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PYTHON_PATH = process.env.PYTHON_BIN || "python";

const PYTHON_SCRIPT = path.resolve(
    __dirname,
    "..",
    "ml1",
    "recommend_cli.py"
);

const TIMEOUT_MS = 60000;

function getRecommendations(userData) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(PYTHON_SCRIPT)) {
            return reject(
                new Error(
                    `Python script not found: ${PYTHON_SCRIPT}`
                )
            );
        }

        const python = spawn(
            PYTHON_PATH,
            ["-u", PYTHON_SCRIPT],
            {
                cwd: path.dirname(PYTHON_SCRIPT),
                windowsHide: true
            }
        );

        let output = "";
        let errorOutput = "";
        let settled = false;

        const timer = setTimeout(() => {
            python.kill();

            finish(
                new Error(
                    "Python recommendation service timed out."
                )
            );
        }, TIMEOUT_MS);

        function finish(error, result) {
            if (settled) return;

            settled = true;
            clearTimeout(timer);

            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        }

        python.stdout.setEncoding("utf8");
        python.stderr.setEncoding("utf8");

        python.stdout.on("data", (chunk) => {
            output += chunk;
        });

        python.stderr.on("data", (chunk) => {
            errorOutput += chunk;
        });

        python.on("error", (error) => {
            finish(
                new Error(
                    `Unable to start Python (${PYTHON_PATH}): ${error.message}`
                )
            );
        });

        python.on("close", (code) => {
            if (settled) return;

            if (code !== 0) {
                return finish(
                    new Error(
                        errorOutput.trim() ||
                        `Python exited with code ${code}.`
                    )
                );
            }

            const response = output.trim();

            if (!response) {
                return finish(
                    new Error(
                        "Python returned empty output." +
                        (errorOutput.trim()
                            ? `\n${errorOutput.trim()}`
                            : "")
                    )
                );
            }

            let result;

            try {
                result = JSON.parse(response);
            } catch (error) {
                return finish(
                    new Error(
                        `Invalid JSON from Python: ${error.message}\n` +
                        `Output: ${response}\n` +
                        `Python stderr: ${errorOutput.trim()}`
                    )
                );
            }

            if (
                result === null ||
                typeof result !== "object"
            ) {
                return finish(
                    new Error(
                        "Python returned an unexpected response format."
                    )
                );
            }

            if (result.error) {
                return finish(new Error(result.error));
            }

            finish(null, result);
        });

        python.stdin.on("error", (error) => {
            if (error.code !== "EPIPE") {
                finish(
                    new Error(
                        `Failed to send input to Python: ${error.message}`
                    )
                );
            }
        });

        try {
            python.stdin.end(
                JSON.stringify(userData ?? {})
            );
        } catch (error) {
            python.kill();
            finish(error);
        }
    });
}

module.exports = {
    getRecommendations
};
