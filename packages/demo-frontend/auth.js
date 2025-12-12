import { authClient } from "./auth-client.js";

// Check if already authenticated
async function checkAuth() {
  try {
    const session = await authClient.getSession();

    if (session && session.data && session.data.user) {
      // Already authenticated, redirect to main app
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

// Tab switching logic
function setupTabs() {
  const signInTab = document.getElementById('signin-tab');
  const signUpTab = document.getElementById('signup-tab');
  const signInForm = document.getElementById('signin-form');
  const signUpForm = document.getElementById('signup-form');

  signInTab.addEventListener('click', () => {
    signInTab.classList.add('active');
    signUpTab.classList.remove('active');
    signInForm.style.display = 'flex';
    signUpForm.style.display = 'none';
  });

  signUpTab.addEventListener('click', () => {
    signUpTab.classList.add('active');
    signInTab.classList.remove('active');
    signUpForm.style.display = 'flex';
    signInForm.style.display = 'none';
  });
}

// Sign-in form handler
function setupSignInForm() {
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('signin-email');
  const passwordInput = document.getElementById('signin-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        alert('Sign in failed: ' + (result.error.message || 'Unknown error'));
        return;
      }

      // Success - redirect to main app
      window.location.href = '/';
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Sign in failed: ' + error.message);
    }
  });
}

// Sign-up form handler
function setupSignUpForm() {
  const form = document.getElementById('signup-form');
  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name || !email || !password) {
      alert('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        // Handle specific error cases
        let errorMessage = result.error.message || 'Unknown error';

        // Check for common errors
        if (errorMessage.includes('already') || errorMessage.includes('exists')) {
          errorMessage = 'This email is already registered. Please sign in instead or use a different email.';
        }

        alert('Sign up failed: ' + errorMessage);
        console.error('Sign up error:', result.error);
        return;
      }

      // Success - redirect to main app
      window.location.href = '/';
    } catch (error) {
      console.error('Sign up error:', error);

      // Handle network errors
      if (error.message === 'Failed to fetch') {
        alert('Network error: Please check that both frontend and backend servers are running.');
      } else {
        alert('Sign up failed: ' + error.message);
      }
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupTabs();
  setupSignInForm();
  setupSignUpForm();
});
