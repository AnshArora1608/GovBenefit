
const { spawn } = require("child_process");
const path = require("path");

const pythonScript = path.resolve(
    __dirname,
    "..",
    "ml",
    "recommend_service.py"
);

function getRecommendations(data) {
    return new Promise((resolve, reject) => {
        const python = spawn(
            "python",
            [pythonScript],
            {
                cwd: path.dirname(pythonScript),
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        python.stdout.setEncoding("utf8");
        python.stderr.setEncoding("utf8");

        python.stdout.on("data", (chunk) => {
            stdout += chunk;
        });

        python.stderr.on("data", (chunk) => {
            stderr += chunk;
        });

        python.on("error", (error) => {
            reject(
                new Error(`Unable to start Python: ${error.message}`)
            );
        });

        python.on("close", (code) => {
            if (code !== 0) {
                return reject(
                    new Error(
                        stderr.trim() ||
                        `Python exited with code ${code}`
                    )
                );
            }

            const response = stdout.trim();

            if (!response) {
                return reject(
                    new Error(
                        `Python returned empty output.\nPython stderr: ${stderr}`
                    )
                );
            }

            try {
                const result = JSON.parse(response);

                if (result && result.error) {
                    return reject(new Error(result.error));
                }

                resolve(result);
            } catch (error) {
                reject(
                    new Error(
                        `Python returned invalid JSON:\n${response}\n\nPython stderr:\n${stderr}`
                    )
                );
            }
        });

        python.stdin.write(JSON.stringify(data));
        python.stdin.end();
    });
}

module.exports = {
    getRecommendations
};

