"use client";

import { useState, useEffect } from "react";

const CONSENT_KEY = "cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem(CONSENT_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 border-t border-gray-200 bg-white px-6 py-3 shadow-md">
      <p className="text-sm text-gray-600">
        本网站使用 Cookie 以维持登录状态及基本功能。
      </p>
      <button
        onClick={accept}
        className="shrink-0 rounded-md px-4 py-1.5 text-sm font-medium text-white"
        style={{ backgroundColor: "#FE5C00" }}
      >
        我知道了
      </button>
    </div>
  );
}
