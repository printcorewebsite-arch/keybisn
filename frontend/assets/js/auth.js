import { api, authStatus, clearNotice, notify, track } from "./core.js";

function setMode(mode) {
  const loginBlock = document.querySelector("[data-auth='login']");
  const registerBlock = document.querySelector("[data-auth='register']");
  const loginBtn = document.querySelector("[data-switch='login']");
  const registerBtn = document.querySelector("[data-switch='register']");

  const isLogin = mode === "login";
  loginBlock?.classList.toggle("hidden", !isLogin);
  registerBlock?.classList.toggle("hidden", isLogin);
  loginBtn?.classList.toggle("btn-primary", isLogin);
  loginBtn?.classList.toggle("btn-ghost", !isLogin);
  registerBtn?.classList.toggle("btn-primary", !isLogin);
  registerBtn?.classList.toggle("btn-ghost", isLogin);
}

async function submitLogin(form, notice) {
  const body = {
    email: form.email.value.trim(),
    password: form.password.value,
  };

  const result = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

  notify(notice, "Connexion réussie. Redirection en cours.", "success");
  await track("auth_login_success");
  window.location.href = result.nextPath || "/dashboard";
}

async function submitRegister(form, notice) {
  const body = {
    fullName: form.fullName.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
  };

  const result = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

  notify(notice, "Compte créé. Redirection en cours.", "success");
  await track("auth_register_success");
  window.location.href = result.nextPath || "/onboarding";
}

document.addEventListener("DOMContentLoaded", async () => {
  const notice = document.getElementById("auth-notice");

  try {
    const status = await authStatus();
    if (status.authenticated) {
      window.location.href = status.nextPath || "/dashboard";
      return;
    }
  } catch {
    // ignore status pre-check
  }

  document.querySelector("[data-switch='login']")?.addEventListener("click", () => setMode("login"));
  document.querySelector("[data-switch='register']")?.addEventListener("click", () => setMode("register"));

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);
    try {
      await submitLogin(loginForm, notice);
    } catch (error) {
      notify(notice, error.message, "error");
      await track("auth_login_error", { message: error.message });
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);
    try {
      await submitRegister(registerForm, notice);
    } catch (error) {
      notify(notice, error.message, "error");
      await track("auth_register_error", { message: error.message });
    }
  });

  setMode("login");
  await track("auth_page_view");
});
