// DOM Elements
const container = document.querySelector('.container');
const chatsContainer = document.querySelector('.chats-container');
const promptForm = document.querySelector('.prompt-form');
const promptInput = promptForm.querySelector('.prompt-input');
const fileInput = promptForm.querySelector('#file-input');
const fileUploadWrapper = promptForm.querySelector('.file-upload-wrapper');
const filePreview = promptForm.querySelector('#file-preview');
const themeToggle = document.querySelector('#theme-toggle-btn');

// API Config
const API_KEY = 'AIzaSyA0tgSzi5XgXx0_J-8dkNJGrrwJ7M2Htoo';  
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
const userData = { message: '', file: {} };
const chatHistory = [];

// Utility: Create message element
const createMsgElement = (content, ...classes) => {
  const div = document.createElement('div');
  div.classList.add('message', ...classes);
  div.innerHTML = content;
  return div;
};

// Utility: Scroll to bottom
const scrollToBottom = () => {
  chatsContainer.scrollTo({ top: chatsContainer.scrollHeight, behavior: 'smooth' });
};

// Typing effect
const typeEffect = (text, textElement, botMsgDiv) => {
  const words = text.split(' ');
  let wordIndex = 0;

  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.innerHTML += (wordIndex === 0 ? '' : ' ') + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove('loading');
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};

// Generate response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector('.message-text');
  controller = new AbortController();

  chatHistory.push({
    role: 'user',
    parts: [
      { text: userData.message },
      ...(userData.file.data
        ? [{
            inline_data: {
              data: userData.file.data,
              mime_type: userData.file.mime_type
            }
          }]
        : [])
    ]
  });

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Something went wrong!');

    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No response";

    //  Formatting fixes
    responseText = responseText
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // bold
      .replace(/\n/g, '<br>')                              // line breaks
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,    // links
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .trim();

    typeEffect(responseText, textElement, botMsgDiv);

    chatHistory.push({
      role: 'model',
      parts: [{ text: responseText }]
    });

  } catch (error) {
    textElement.style.color = '#d62939';
    textElement.textContent = error.name === 'AbortError' ? '⚠️ Request canceled.' : '⚠️ Something went wrong!';
    botMsgDiv.classList.remove('loading');
    document.body.classList.remove("bot-responding");
    console.error('Error:', error);
  } finally {
    userData.file = {};
  }
};

// Handle form submit
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if ((!userMessage && !userData.file.data) || document.body.classList.contains("bot-responding")) return;

  promptInput.value = '';
  userData.message = userMessage;
  document.body.classList.add('bot-responding', "chats-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  //  User message bubble
  const userMsgHTML = `<p class="message-text"></p>`;
  const userMsgDiv = createMsgElement(userMsgHTML, 'user-message');

  if (userMessage) {
    userMsgDiv.querySelector('.message-text').textContent = userMessage; // Safe
  }

  //  Show file if uploaded
  if (userData.file.data) {
    if (userData.file.isImage) {
      const imgTag = document.createElement("img");
      imgTag.src = `data:${userData.file.mime_type};base64,${userData.file.data}`;
      imgTag.className = "uploaded-img";
      userMsgDiv.appendChild(imgTag);
    } else {
      const fileTag = document.createElement("p");
      fileTag.textContent = `📎 ${userData.file.fileName}`;
      fileTag.className = "uploaded-file";
      userMsgDiv.appendChild(fileTag);
    }
  }

  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  //  Bot placeholder
  setTimeout(() => {
    const botMsgHTML = `<img src="images/gemini.svg" class="avatar"><p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, 'bot-message', 'loading');
    chatsContainer.appendChild(botMsgDiv);

    generateResponse(botMsgDiv);
    scrollToBottom();
  }, 100);
};

// Handle file input
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith('image/');
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    const base64String = e.target.result.split(',')[1];
    fileUploadWrapper.classList.add("active");

    if (isImage) {
      filePreview.src = e.target.result;
      filePreview.classList.remove("hidden");
    } else {
      filePreview.src = "";
      filePreview.classList.add("hidden");

      fileUploadWrapper.querySelector(".file-name")?.remove();
      const fileNameEl = document.createElement("p");
      fileNameEl.className = "file-name";
      fileNameEl.textContent = `📎 ${file.name}`;
      fileUploadWrapper.appendChild(fileNameEl);
    }

    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage
    };
  };
});

// Stop response + file clear
document.querySelector('#cancel-file-preview-btn').addEventListener('click', () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

document.querySelector('#stop-response-btn').addEventListener('click', () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

document.querySelector("#delete-chats-btn").addEventListener("click", ()=>  {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("bot-responding", "chats-active");
});

// Suggestions click
document.querySelectorAll(".suggestion-item").forEach(item => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event('submit'));
    promptInput.focus();
  });
});

// Theme toggle
themeToggle.addEventListener('click', () => {
  const isLightTheme = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLightTheme ? 'light_mode' : 'dark_mode');
  themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';
});

const isLightTheme = localStorage.getItem('theme') === 'light_mode';
document.body.classList.toggle('light-theme', isLightTheme);
themeToggle.textContent = isLightTheme ? 'dark_mode' : 'light_mode';

// Event listeners
promptForm.addEventListener('submit', handleFormSubmit);
promptForm.querySelector('#add-file-btn').addEventListener('click', () => fileInput.click());
