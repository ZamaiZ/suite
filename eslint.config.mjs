import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worker do MapLibre, copiado minificado pelo `postinstall`. Não é código
    // nosso e não é editável — lintá-lo rendia mais de mil advertências que
    // afogavam as reais.
    "public/maplibre/**",
  ]),
  {
    // `components/ui` é código gerado pelo CLI do shadcn e volta ao original a
    // cada `add`. Corrigir um padrão do registry aqui é trabalho que o próximo
    // `add` desfaz — e a regra de estilo de efeito é opinião do React Compiler,
    // não contrato deste produto. O que policiamos nesses arquivos é o que a
    // gente edita de propósito: o import de ícone (ver `checks.md`).
    files: ["components/ui/**/*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
])

export default eslintConfig
