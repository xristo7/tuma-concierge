"use client";

import { useEffect, useState } from "react";

function calculate(input: string): number | undefined {
  const source = input.replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!source) return undefined;

  let index = 0;

  function expression(): number {
    let value = term();
    while (source[index] === "+" || source[index] === "-") {
      const operator = source[index++];
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function term(): number {
    let value = factor();
    while (source[index] === "*" || source[index] === "/") {
      const operator = source[index++];
      const right = factor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function factor(): number {
    if (source[index] === "+" || source[index] === "-") {
      const sign = source[index++] === "-" ? -1 : 1;
      return sign * factor();
    }

    if (source[index] === "(") {
      index += 1;
      const value = expression();
      if (source[index] !== ")") throw new Error("Missing closing bracket");
      index += 1;
      return value;
    }

    const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("Expected a number");
    index += match[0].length;
    return Number(match[0]);
  }

  try {
    const result = expression();
    if (index !== source.length || !Number.isFinite(result) || result < 0) return undefined;
    return Math.round(result);
  } catch {
    return undefined;
  }
}

export function InlineMathInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState(value == null ? "" : String(value));
  const result = calculate(input);

  useEffect(() => {
    if (value != null && calculate(input) !== value) setInput(String(value));
    if (value == null && calculate(input) != null) setInput("");
    // `input` is deliberately excluded: external value changes should sync
    // the field without replacing a calculation while the customer types it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function apply() {
    if (result == null) return;
    setInput(String(result));
    onChange(result);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-ink-500">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
          inputMode="decimal"
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border-faint)] bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={apply}
          disabled={result == null}
          className="rounded-xl bg-gold px-3 py-2 text-sm font-bold text-ink-gold disabled:opacity-40"
        >
          Use
        </button>
      </div>
      {input && result == null && <p className="text-xs text-red-600">Enter a valid calculation.</p>}
      {result != null && input !== String(result) && (
        <p className="text-xs text-ink-500">Result: UGX {result.toLocaleString("en-UG")}</p>
      )}
    </div>
  );
}
