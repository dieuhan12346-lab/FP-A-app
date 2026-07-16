import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const dep = (name) => path.resolve(root, "node_modules", name);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@target-app": path.resolve(root, "src/phanmem-dongtien_4.jsx"),
      react: dep("react"),
      "react-dom": dep("react-dom"),
      recharts: dep("recharts"),
      xlsx: dep("xlsx"),
      "lucide-react": dep("lucide-react"),
    },
  },
  server: {
    host: true, // nghe cả IPv4 lẫn IPv6 — tránh lỗi trình duyệt gọi localhost qua 127.0.0.1 không vào được
    fs: {
      strict: false,
      allow: ["."],
    },
  },
});
