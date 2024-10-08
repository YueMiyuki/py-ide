"use client";

import { useState, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubDark } from "@uiw/codemirror-theme-github";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Console } from "@/components/Console";
import { VersionControl } from "@/components/VersionControl";
import { DiffViewerModal } from "@/components/DiffViewerModal";
import { useSocket } from "@/hooks/useSocket";
import { CheckCircle, AlertTriangle, Download } from "lucide-react";
import Link from "next/link";

interface Version {
  id: number;
  code: string;
}

export default function PythonEditor() {
  const [code, setCode] = useState<string>("print('Hello, World!')");
  const [isMounted, setIsMounted] = useState<boolean>(false); // Track if component is mounted
  const [output, setOutput] = useState<string>("");
  const [versions, setVersions] = useState<Version[]>([
    { id: 1, code: "print('Hello, World!')" },
  ]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [diffVersions, setDiffVersions] = useState<{
    old: number;
    new: number;
  }>({ old: 0, new: 1 });
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const socket = useSocket();
  const consoleRef = useRef<HTMLDivElement>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Ensure component is mounted before accessing localStorage
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const savedCode = localStorage.getItem("pythonCode");
      if (savedCode) {
        setCode(savedCode);
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("pythonCode", code);
    }
  }, [code, isMounted]);

  useEffect(() => {
    if (socket) {
      socket.on("output", (data: string) => {
        setOutput((prev) => prev + data);

        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }

        resetTimer(); // Reset the process time limit every time output is received
      });

      socket.on("exit", (code: number) => {
        setIsRunning(false);
        setExitCode(code);
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 3000);

        // Clear timeout when the process has stopped
        if (timeoutId) {
          clearTimeout(timeoutId);
          setTimeoutId(null);
        }
      });
    }
  }, [socket]);

  // Reset the timer for the running process (track for 60s)
  const resetTimer = () => {
    if (timeoutId) clearTimeout(timeoutId);

    const newTimeoutId = setTimeout(() => {
      stopCode(); // Automatically stop if the process runs for more than 60 seconds
    }, 60000);

    setTimeoutId(newTimeoutId);
  };

  const runCode = () => {
    if (isRunning || !socket) return;

    setIsRunning(true);
    setOutput(""); // Reset output on new run
    setExitCode(null);

    const newVersion: Version = { id: versions.length + 1, code };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.id);

    // Emit 'run' event via Socket.io to the server with the code payload
    socket.emit("run", code);
    resetTimer(); // Start/reset the 60 seconds timeout
  };

  const stopCode = () => {
    if (!isRunning || !socket) return;

    socket.emit("stop");
    if (timeoutId) clearTimeout(timeoutId); // Stop tracking timeout when stopping the code manually
    setTimeoutId(null);
  };

  const handleVersionChange = (versionId: number) => {
    const version = versions.find((v) => v.id === versionId);
    if (version) {
      setCode(version.code);
      setCurrentVersion(versionId);
    }
  };

  const toggleDiff = () => {
    setShowDiff(!showDiff);
    if (!showDiff) {
      setDiffVersions({ old: versions.length - 1, new: versions.length });
    }
  };

  const downloadCode = () => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    element.download = `python_code_${timestamp}.py`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a192f] text-white flex flex-col">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a192f] via-[#0d2a4a] to-[#1a365d] z-0"></div>

      {/* Animated raylights */}
      {[...Array(5)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute w-1 h-[200%] bg-[#ffa50033] blur-sm"
          style={{
            left: `${(index + 1) * 20}%`,
            rotate: 30,
            transformOrigin: "top",
          }}
          animate={{
            scaleY: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            delay: index * 0.5,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 flex flex-col flex-grow p-4"
      >
        <motion.div
          className="flex justify-between items-center mb-4"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
        >
          <VersionControl
            versions={versions}
            currentVersion={currentVersion}
            onVersionChange={handleVersionChange}
          />
          <div className="flex space-x-2">
            <Button onClick={runCode} disabled={isRunning}>
              Run
            </Button>
            <Button
              onClick={stopCode}
              disabled={!isRunning}
              variant="secondary"
            >
              Stop
            </Button>
            <Button
              onClick={toggleDiff}
              variant="outline"
              className="bg-[#1a365d] text-white hover:bg-[#0d2a4a]"
            >
              Show Diff
            </Button>
            <Button
              onClick={downloadCode}
              variant="outline"
              className="bg-[#1a365d] text-white hover:bg-[#0d2a4a]"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </motion.div>
        <div className="flex flex-1 space-x-4">
          <motion.div className="w-1/2" initial={{ x: -20 }} animate={{ x: 0 }}>
            <div className="h-full overflow-hidden rounded-lg shadow-lg">
              <CodeMirror
                value={code}
                height="100%"
                theme={githubDark}
                extensions={[python()]}
                onChange={(value) => setCode(value)}
                className="h-full overflow-auto"
              />
            </div>
          </motion.div>
          <motion.div
            className="w-1/2 flex flex-col"
            initial={{ x: 20 }}
            animate={{ x: 0 }}
          >
            <div className="flex-1 overflow-hidden rounded-lg shadow-lg">
              <Console
                output={output}
                isRunning={isRunning}
                onInput={(input) => {
                  // Echo the input the user typed in the UI
                  setOutput((prev) => prev + `<USER WSS> ${input}\n`);
                  socket?.emit("input", input);

                  // Reset the 60-second timeout upon new input
                  resetTimer();
                }}
                ref={consoleRef}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <footer className="relative z-10 py-4 text-center bg-[#0a192f] border-t border-[#1a365d]">
        <p>
          Designed with{" "}
          <span role="img" aria-label="love">
            ❤️
          </span>{" "}
          by{" "}
          <Link
            href="https://mdesk.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ffa500] hover:underline"
          >
            mdesk.tech
          </Link>
        </p>
      </footer>

      <DiffViewerModal
        isOpen={showDiff}
        onClose={() => setShowDiff(false)}
        versions={versions}
        diffVersions={diffVersions}
        setDiffVersions={setDiffVersions}
      />

      <AnimatePresence>
        {showAlert && exitCode !== null && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed bottom-4 right-4 z-50 w-[30%]"
          >
            <Alert
              variant={exitCode === 0 ? "default" : "destructive"}
              className={`border ${
                exitCode === 0
                  ? "bg-green-500 border-green-600"
                  : "bg-red-500 border-red-600"
              } text-white`}
            >
              {exitCode === 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle className="font-semibold">
                {exitCode === 0 ? "Success" : "Error"}
              </AlertTitle>
              <AlertDescription>
                {exitCode === 0
                  ? "Python code executed successfully."
                  : `Python code exited with error code: ${exitCode}`}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
