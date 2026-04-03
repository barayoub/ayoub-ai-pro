import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { auth, provider, database } from './firebaseConfig';
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, push, set, onValue, remove, update } from "firebase/database";
import './App.css';

// ========== GEMINI API CONFIGURATION ==========
const GEMINI_API_KEY = "AIzaSyCotCSeaM8YdwUUscciMAduNsgeULs0QT8";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function App() {
  // ========== STATES ==========
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('ayoub_pro_v27');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('font-size')) || 16);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : { loggedIn: false };
  });
  const [isListening, setIsListening] = useState(false);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [conversationHistory, setConversationHistory] = useState(() => {
    const saved = localStorage.getItem('conversations');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentConversationId, setCurrentConversationId] = useState(Date.now().toString());
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');
  const [model, setModel] = useState(GEMINI_MODEL);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageQuestion, setImageQuestion] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  
  // ========== FILE UPLOAD STATES ==========
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileType, setFileType] = useState('');
  
  // ========== REFS ==========
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const plusMenuRef = useRef(null);
  
  // ========== FIREBASE AUTH ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          loggedIn: true,
          name: firebaseUser.displayName || "User",
          email: firebaseUser.email,
          photo: firebaseUser.photoURL || "👤",
          method: "google",
          uid: firebaseUser.uid
        });
      }
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result) {
        setUser({
          loggedIn: true,
          name: result.user.displayName || "User",
          email: result.user.email,
          photo: result.user.photoURL || "👤",
          method: "google",
          uid: result.user.uid
        });
        setShowLoginModal(false);
      }
    }).catch((error) => {
      console.error("Redirect error:", error);
    });
  }, []);
  
  // PWA Install
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    });
  }, []);
  
  // Fermer le menu plus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) {
        setShowPlusMenu(false);
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      setDeferredPrompt(null);
    } else {
      alert("Installation will be available when you open this app from HTTPS server (not localhost)");
    }
  };
  
  const handleGoogleLogin = async () => {
    setShowLoginModal(false);
    try {
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setUser({
        loggedIn: true,
        name: result.user.displayName || "User",
        email: result.user.email,
        photo: result.user.photoURL || "👤",
        method: "google",
        uid: result.user.uid
      });
    } catch (error) {
      console.error("Popup error:", error);
      if (error.code === 'auth/popup-blocked') {
        if (window.confirm("Popup was blocked. Click OK to redirect to Google login page.")) {
          await signInWithRedirect(auth, provider);
        }
      } else {
        alert(`Login failed: ${error.message}`);
      }
    }
  };
  
  const handleGuestLogin = () => {
    setUser({ 
      loggedIn: true, 
      name: "Guest User", 
      photo: "👤", 
      method: "guest",
      email: "guest@ayoub.ai"
    });
    setShowLoginModal(false);
  };
  
  const handleLogout = async () => {
    if (user.method === 'google') {
      await signOut(auth);
    }
    setUser({ loggedIn: false });
    setConversationHistory([]);
    setMessages([]);
    setShowLoginModal(false);
  };
  
  // ========== SAVE TO LOCALSTORAGE ==========
  useEffect(() => {
    localStorage.setItem('ayoub_pro_v27', JSON.stringify(messages));
    localStorage.setItem('theme', theme);
    localStorage.setItem('font-size', fontSize);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('conversations', JSON.stringify(conversationHistory));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, theme, fontSize, user, conversationHistory]);
  
  // ========== AUTO SAVE CONVERSATIONS ==========
  useEffect(() => {
    if (messages.length > 0) {
      const title = messages[0]?.text?.substring(0, 35) || "New Chat";
      const existingIndex = conversationHistory.findIndex(c => c.id === currentConversationId);
      
      if (existingIndex >= 0) {
        const updated = [...conversationHistory];
        updated[existingIndex] = { 
          ...updated[existingIndex], 
          messages: messages, 
          title: title, 
          updatedAt: Date.now() 
        };
        setConversationHistory(updated);
      } else {
        setConversationHistory(prev => [...prev, { 
          id: currentConversationId, 
          title: title, 
          messages: messages, 
          createdAt: Date.now(), 
          updatedAt: Date.now(), 
          pinned: false 
        }]);
      }
    }
  }, [messages]);
  
  // ========== CONVERSATIONS FUNCTIONS ==========
  const newConversation = () => {
    const newId = Date.now().toString();
    setCurrentConversationId(newId);
    setMessages([]);
    setUploadedFile(null);
    setFileContent('');
    setFileName('');
    setFileSize('');
    setFileType('');
    if (window.innerWidth <= 768) setSidebarOpen(false);
    setActiveMenuId(null);
  };
  
  const loadConversation = (conv) => {
    setCurrentConversationId(conv.id);
    if (conv.messages && conv.messages.length > 0) {
      setMessages(conv.messages);
    } else {
      setMessages([]);
    }
    if (window.innerWidth <= 768) setSidebarOpen(false);
    setActiveMenuId(null);
  };
  
  const deleteConversation = (id, e) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation?")) {
      setConversationHistory(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        newConversation();
      }
    }
    setActiveMenuId(null);
  };
  
  const togglePinConversation = (id, e) => {
    e.stopPropagation();
    setConversationHistory(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
    setActiveMenuId(null);
  };
  
  const renameConversation = (id, e) => {
    e.stopPropagation();
    const newTitle = prompt("Enter new title for this chat:", conversationHistory.find(c => c.id === id)?.title || "New Chat");
    if (newTitle && newTitle.trim()) {
      setConversationHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle.trim() } : c));
    }
    setActiveMenuId(null);
  };
  
  // ========== STOP GENERATION ==========
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setLoading(false);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: '⏹️ Generation stopped.', 
        id: `b-${Date.now()}`, 
        time: new Date().toLocaleTimeString() 
      }]);
    }
  };
  
  // ========== EDIT MESSAGE ==========
  const startEditing = (messageId, currentText) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };
  
  const saveEditedMessage = async (messageId, index) => {
    if (!editingText.trim()) return;
    
    const updatedMessages = [...messages];
    updatedMessages[index].text = editingText;
    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingText('');
    
    if (index + 1 < updatedMessages.length && updatedMessages[index + 1].role === 'model') {
      const newMessages = updatedMessages.slice(0, index + 1);
      setMessages(newMessages);
      await handleSend(editingText, true);
    }
  };
  
  // ========== CLEAR UPLOADED FILE ==========
  const clearUploadedFile = () => {
    const oldFileName = fileName;
    setUploadedFile(null);
    setFileContent('');
    setFileName('');
    setFileSize('');
    setFileType('');
    setMessages(prev => [...prev, { 
      role: 'model', 
      text: `🗑️ **File cleared:** "${oldFileName}" has been removed from memory.`, 
      id: `b-${Date.now()}`, 
      time: new Date().toLocaleTimeString() 
    }]);
  };
  
  // ========== FILE UPLOAD ==========
  const handleFileUpload = async (file) => {
    if (!file) return;
    setShowPlusMenu(false);
    
    const fileSizeKB = (file.size / 1024).toFixed(2);
    const fileTypeName = file.type || file.name.split('.').pop();
    
    setUploadedFile(file);
    setFileName(file.name);
    setFileSize(fileSizeKB);
    setFileType(fileTypeName);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: `📁 **File Uploaded:** ${file.name}\n📊 Size: ${fileSizeKB} KB\n📄 Type: ${fileTypeName}\n\n_Processing file..._`, 
      id: `m-${Date.now()}`, 
      time: new Date().toLocaleTimeString() 
    }]);
    
    try {
      if (file.type === 'application/pdf') {
        setFileContent(`[PDF File: ${file.name} - ${fileSizeKB} KB]`);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `⚠️ **PDF Notice:** "${file.name}"\n\n📊 **File Info:**\n- Size: ${fileSizeKB} KB\n- Type: PDF Document\n\nℹ️ **Note:** PDF files cannot be read directly by the AI.\n\n**What you can do:**\n1. Copy text from the PDF and paste it here\n2. Ask general questions about PDFs\n3. Upload a TXT file instead\n\nThe file is ready. You can still ask me questions, but I won't see the content.`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } else if (file.type.startsWith('image/')) {
        onImageSelect(file);
        return;
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const textContent = e.target.result;
          setFileContent(textContent.substring(0, 50000));
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: `✅ **File Ready:** "${file.name}"\n\n📊 **Stats:**\n- Size: ${fileSizeKB} KB\n- Characters: ${textContent.length}\n- Lines: ${textContent.split('\n').length}\n\n✨ **File loaded successfully!** Now you can ask me anything about this file.`, 
            id: `b-${Date.now()}`, 
            time: new Date().toLocaleTimeString() 
          }]);
        };
        reader.readAsText(file);
        return;
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `❌ **Error reading file:** ${error.message}`, 
        id: `b-${Date.now()}`, 
        time: new Date().toLocaleTimeString() 
      }]);
    }
  };
  
  // ========== GEMINI TOOLS ==========
  const tools = {
    createImage: async (prompt) => {
      setLoading(true);
      setShowToolsMenu(false);
      try {
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Create a detailed image generation prompt for: ${prompt}. Return ONLY the prompt text.` }] }]
          })
        });
        const data = await response.json();
        let imagePrompt = "Could not generate image prompt.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          imagePrompt = data.candidates[0].content.parts[0].text;
        }
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `🎨 **Image Prompt:**\n\n${imagePrompt}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    deepSearch: async (query) => {
      setLoading(true);
      setShowToolsMenu(false);
      try {
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Perform deep research on: ${query}. Provide comprehensive analysis with key points, latest developments, and future trends.` }] }]
          })
        });
        const data = await response.json();
        let analysis = "Could not perform search.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          analysis = data.candidates[0].content.parts[0].text;
        }
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `🔍 **Deep Search:**\n\n${analysis}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    generateCode: async (request) => {
      setLoading(true);
      setShowToolsMenu(false);
      try {
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Write code for: ${request}. Provide complete working code with comments and explanations.` }] }]
          })
        });
        const data = await response.json();
        let code = "Could not generate code.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          code = data.candidates[0].content.parts[0].text;
        }
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `💻 **Code:**\n\n${code}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };
  
  // ========== IMAGE ANALYSIS ==========
  const handleImageWithQuestion = async (file, question) => {
    if (!file) return;
    setShowImageModal(false);
    setAnalyzingImage(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result.split(',')[1];
      
      setMessages(prev => [...prev, { 
        role: 'user', 
        text: question ? `📷 **Question about image:** ${question}` : `📷 **Image uploaded for analysis**`, 
        id: `m-${Date.now()}`, 
        time: new Date().toLocaleTimeString()
      }]);
      
      try {
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: question || "What's in this image? Describe in detail." },
                { inlineData: { mimeType: file.type, data: base64Image } }
              ]
            }]
          })
        });
        const data = await response.json();
        let description = "Could not analyze image.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          description = data.candidates[0].content.parts[0].text;
        }
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `🖼️ **Image Analysis:**\n\n${description}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `❌ Error analyzing image: ${error.message}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      } finally {
        setAnalyzingImage(false);
        setImagePreview(null);
        setImageQuestion('');
      }
    };
    reader.readAsDataURL(file);
  };
  
  const onImageSelect = (file) => {
    if (!file) return;
    setImagePreview(file);
    setShowImageModal(true);
    setShowPlusMenu(false);
  };
  
  // ========== VOICE INPUT ==========
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice input not supported");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
  };
  
  // ========== TEXT TO SPEECH ==========
  const textToSpeech = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };
  
  // ========== EXPORT CHAT ==========
  const exportChatAsTXT = () => {
    let content = "🤖 Ayoub AI - Chat Export\n" + "=".repeat(50) + "\n📅 " + new Date().toLocaleString() + "\n\n";
    messages.forEach(m => {
      content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${m.role === 'user' ? '👤 YOU' : '🤖 Ayoub AI'} [${m.time}]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${m.text}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ayoub-ai-chat-${Date.now()}.txt`;
    link.click();
  };
  
  // ========== SEND MESSAGE TO GEMINI ==========
  const handleSend = async (retryText = null, isEdit = false) => {
    const text = retryText || input;
    if (!text || !text.trim()) return;
    
    if (abortController && !isEdit) {
      abortController.abort();
    }
    
    const controller = new AbortController();
    setAbortController(controller);
    
    if (!retryText && !isEdit) {
      let userMessage = text;
      if (uploadedFile && fileName) {
        userMessage = `📁 **[File: ${fileName}]**\n\n${text}`;
      }
      setMessages(prev => [...prev, { 
        role: 'user', 
        text: userMessage, 
        id: `m-${Date.now()}`, 
        time: new Date().toLocaleTimeString()
      }]);
    }
    setInput('');
    setLoading(true);
    setIsGenerating(true);
    setShowPlusMenu(false);
    setShowToolsMenu(false);
    
    try {
      let promptText = text;
      
      if (fileContent && uploadedFile && fileName && fileType !== 'application/pdf') {
        promptText = `You have a file loaded named "${fileName}" (${fileSize} KB, type: ${fileType}).\n\nFILE CONTENT:\n${fileContent.substring(0, 30000)}\n\nBased on this file, answer the following question:\n\nQUESTION: ${text}\n\nPlease answer based ONLY on the file content above. If the answer is not found in the file, say "I couldn't find that information in the file."`;
      } else if (uploadedFile && fileName && fileType === 'application/pdf') {
        promptText = `${text}\n\nNote: The user has uploaded a PDF file named "${fileName}". Since PDF content cannot be read directly, please provide general guidance on how to work with PDFs or answer based on the question itself.`;
      }
      
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });
      
      const data = await response.json();
      let botText = "⚠️ Sorry, couldn't process that.";
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        botText = data.candidates[0].content.parts[0].text;
      } else if (data.error) {
        botText = `❌ Error: ${data.error.message}`;
      }
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: botText, 
        id: `b-${Date.now()}`, 
        time: new Date().toLocaleTimeString() 
      }]);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `❌ Error: ${error.message}`, 
          id: `b-${Date.now()}`, 
          time: new Date().toLocaleTimeString() 
        }]);
      }
    } finally {
      setLoading(false);
      setIsGenerating(false);
      setAbortController(null);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied!");
  };
  
  const regenerateMessage = async (messageIndex) => {
    const previousUserMessage = messages[messageIndex - 1];
    if (previousUserMessage && previousUserMessage.role === 'user') {
      setLoading(true);
      try {
        let promptText = previousUserMessage.text.replace(/📁.*?\n\n/, '');
        
        if (fileContent && uploadedFile && fileName && fileType !== 'application/pdf') {
          promptText = `You have a file loaded named "${fileName}" (${fileSize} KB, type: ${fileType}).\n\nFILE CONTENT:\n${fileContent.substring(0, 30000)}\n\nBased on this file, answer the following question:\n\nQUESTION: ${promptText}\n\nPlease answer based ONLY on the file content above.`;
        }
        
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });
        const data = await response.json();
        let newText = "Error regenerating.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          newText = data.candidates[0].content.parts[0].text;
        }
        setMessages(prev => prev.map((msg, idx) => 
          idx === messageIndex ? { ...msg, text: newText, time: new Date().toLocaleTimeString() } : msg
        ));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };
  
  // ========== GROUP CONVERSATIONS BY DATE ==========
  const groupConversationsByDate = (conversations) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);
    
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };
    
    conversations.forEach(conv => {
      const convDate = new Date(conv.updatedAt || conv.createdAt || 0);
      convDate.setHours(0, 0, 0, 0);
      
      if (convDate.getTime() === today.getTime()) {
        groups.today.push(conv);
      } else if (convDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(conv);
      } else if (convDate > thisWeek) {
        groups.thisWeek.push(conv);
      } else if (convDate > thisMonth) {
        groups.thisMonth.push(conv);
      } else {
        groups.older.push(conv);
      }
    });
    
    return groups;
  };
  
  const filteredConversations = conversationHistory.filter(conv => 
    conv.title && conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const groupedConversations = groupConversationsByDate(filteredConversations);
  
  // ========== RENDER ==========
  return (
    <div className={`ayoub-ultra-app ${theme}`} style={{ fontSize: `${fontSize}px` }}>
      {/* Sidebar */}
      <aside className={`pro-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-header">
          <button className="new-chat" onClick={newConversation}>✨ New Chat</button>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        
        <div className="search-history">
          <input 
            type="text" 
            placeholder="🔍 Search conversations..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="history-zone">
          {filteredConversations.length === 0 && !searchTerm && (
            <div className="no-results">✨ No chats yet</div>
          )}
          
          {groupedConversations.today.length > 0 && (
            <div className="history-group">
              <div className="group-label">Today</div>
              {groupedConversations.today.map((conv) => (
                <div key={conv.id} className={`h-item ${currentConversationId === conv.id ? 'active' : ''}`} onClick={() => loadConversation(conv)}>
                  <span className="h-item-title">{conv.pinned && "📌 "}{conv.title?.length > 30 ? conv.title.substring(0, 30) + "..." : conv.title || "New Chat"}</span>
                  <div className="h-item-actions">
                    <button className="menu-trigger-btn" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === conv.id ? null : conv.id); }}>⋮</button>
                  </div>
                  {activeMenuId === conv.id && (
                    <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => togglePinConversation(conv.id, e)}>{conv.pinned ? "📍 Unpin" : "📌 Pin"}</button>
                      <button onClick={(e) => renameConversation(conv.id, e)}>✏️ Rename</button>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="delete-opt">🗑️ Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {groupedConversations.yesterday.length > 0 && (
            <div className="history-group">
              <div className="group-label">Yesterday</div>
              {groupedConversations.yesterday.map((conv) => (
                <div key={conv.id} className={`h-item ${currentConversationId === conv.id ? 'active' : ''}`} onClick={() => loadConversation(conv)}>
                  <span className="h-item-title">{conv.pinned && "📌 "}{conv.title?.length > 30 ? conv.title.substring(0, 30) + "..." : conv.title || "New Chat"}</span>
                  <div className="h-item-actions">
                    <button className="menu-trigger-btn" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === conv.id ? null : conv.id); }}>⋮</button>
                  </div>
                  {activeMenuId === conv.id && (
                    <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => togglePinConversation(conv.id, e)}>{conv.pinned ? "📍 Unpin" : "📌 Pin"}</button>
                      <button onClick={(e) => renameConversation(conv.id, e)}>✏️ Rename</button>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="delete-opt">🗑️ Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {groupedConversations.thisWeek.length > 0 && (
            <div className="history-group">
              <div className="group-label">This Week</div>
              {groupedConversations.thisWeek.map((conv) => (
                <div key={conv.id} className={`h-item ${currentConversationId === conv.id ? 'active' : ''}`} onClick={() => loadConversation(conv)}>
                  <span className="h-item-title">{conv.pinned && "📌 "}{conv.title?.length > 30 ? conv.title.substring(0, 30) + "..." : conv.title || "New Chat"}</span>
                  <div className="h-item-actions">
                    <button className="menu-trigger-btn" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === conv.id ? null : conv.id); }}>⋮</button>
                  </div>
                  {activeMenuId === conv.id && (
                    <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => togglePinConversation(conv.id, e)}>{conv.pinned ? "📍 Unpin" : "📌 Pin"}</button>
                      <button onClick={(e) => renameConversation(conv.id, e)}>✏️ Rename</button>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="delete-opt">🗑️ Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {groupedConversations.thisMonth.length > 0 && (
            <div className="history-group">
              <div className="group-label">This Month</div>
              {groupedConversations.thisMonth.map((conv) => (
                <div key={conv.id} className={`h-item ${currentConversationId === conv.id ? 'active' : ''}`} onClick={() => loadConversation(conv)}>
                  <span className="h-item-title">{conv.pinned && "📌 "}{conv.title?.length > 30 ? conv.title.substring(0, 30) + "..." : conv.title || "New Chat"}</span>
                  <div className="h-item-actions">
                    <button className="menu-trigger-btn" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === conv.id ? null : conv.id); }}>⋮</button>
                  </div>
                  {activeMenuId === conv.id && (
                    <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => togglePinConversation(conv.id, e)}>{conv.pinned ? "📍 Unpin" : "📌 Pin"}</button>
                      <button onClick={(e) => renameConversation(conv.id, e)}>✏️ Rename</button>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="delete-opt">🗑️ Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {groupedConversations.older.length > 0 && (
            <div className="history-group">
              <div className="group-label">Older</div>
              {groupedConversations.older.map((conv) => (
                <div key={conv.id} className={`h-item ${currentConversationId === conv.id ? 'active' : ''}`} onClick={() => loadConversation(conv)}>
                  <span className="h-item-title">{conv.pinned && "📌 "}{conv.title?.length > 30 ? conv.title.substring(0, 30) + "..." : conv.title || "New Chat"}</span>
                  <div className="h-item-actions">
                    <button className="menu-trigger-btn" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === conv.id ? null : conv.id); }}>⋮</button>
                  </div>
                  {activeMenuId === conv.id && (
                    <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => togglePinConversation(conv.id, e)}>{conv.pinned ? "📍 Unpin" : "📌 Pin"}</button>
                      <button onClick={(e) => renameConversation(conv.id, e)}>✏️ Rename</button>
                      <button onClick={(e) => deleteConversation(conv.id, e)} className="delete-opt">🗑️ Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="side-bottom">
          {user.loggedIn ? (
            <div className="user-profile-row">
              <div className="avatar-mini">
                {user.photo && user.photo !== "👤" && user.photo.startsWith('http') ? (
                  <img src={user.photo} alt="avatar" className="avatar-img" />
                ) : "👤"}
              </div>
              <div className="user-details">
                <span>{user.name?.length > 20 ? user.name.substring(0, 20) + "..." : user.name}</span>
                <small>{user.method === 'google' ? 'Google User' : 'Guest'}</small>
              </div>
              <button className="logout-sm" onClick={handleLogout}>🚪</button>
            </div>
          ) : (
            <button className="google-auth-btn" onClick={() => setShowLoginModal(true)}>🔐 Sign In</button>
          )}
        </div>
      </aside>
      
      {/* Sidebar Toggle */}
      {!sidebarOpen && (
        <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(true)}>☰</button>
      )}
      
      {/* Rail Timeline */}
      {messages.length > 1 && (
        <div className="rail-timeline">
          {messages.map((m, idx) => (
            <div key={idx} className={`rail-point ${m.role === 'user' ? 'user' : 'ai'}`} 
              onClick={() => document.getElementById(m.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
              title={`${m.role === 'user' ? 'You' : 'AI'} - ${m.time}`} />
          ))}
        </div>
      )}
      
      {/* Main Chat */}
      <main className="chat-viewport">
        <header className="pro-navbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="pro-title">
            <span className="logo-ayoub">Ayoub AI</span> <span className="logo-badge">Pro</span>
          </div>
          <div className="nav-actions">
            {showInstallButton && (
              <button className="install-pwa-btn" onClick={installApp}>
                📲 Install
              </button>
            )}
            {messages.length > 0 && <button className="export-btn" onClick={exportChatAsTXT}>📎 Export</button>}
            <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙️</button>
          </div>
        </header>
        
        <section className="messages-flow">
          {messages.length === 0 && (
            <div className="hero-landing">
              <div className="hero-icon">🤖</div>
              <h1>Ayoub AI <span className="highlight">Pro</span></h1>
              <p className="hero-subtitle">Your intelligent assistant powered by Google Gemini</p>
              <div className="hero-chips">
                <button onClick={() => setInput("Write a professional resume")}>📄 Resume</button>
                <button onClick={() => setInput("Explain React hooks")}>⚛️ React Hooks</button>
                <button onClick={() => setInput("Write a Python script")}>🐍 Python</button>
                <button onClick={() => setInput("Create a workout plan")}>💪 Fitness</button>
              </div>
            </div>
          )}
          
          {/* File indicator */}
          {uploadedFile && fileName && (
            <div className="file-indicator">
              <div className="file-info">
                <span className="file-icon">📁</span>
                <span className="file-name">{fileName}</span>
                <span className="file-size">({fileSize} KB)</span>
                <button className="clear-file-btn" onClick={clearUploadedFile} title="Clear file">✕</button>
              </div>
              <div className="file-note">💡 {fileType === 'application/pdf' ? 'PDF loaded (content not readable)' : 'File loaded. Ask me anything!'}</div>
            </div>
          )}
          
          {messages.map((m, idx) => (
            <div key={idx} id={m.id} className={`msg-block ${m.role === 'user' ? 'user' : 'ai'}`}>
              <div className="msg-avatar">
                {m.role === 'user' ? (
                  user.photo && user.photo !== "👤" && user.photo.startsWith('http') ? 
                    <img src={user.photo} alt="avatar" className="avatar-img" /> : "👤"
                ) : "🤖"}
              </div>
              <div className="msg-content">
                <div className="msg-header">
                  <span className="msg-role">{m.role === 'user' ? (user.name?.split(' ')[0] || 'You') : 'Ayoub AI'}</span>
                  <span className="msg-time">{m.time}</span>
                  {m.role === 'user' && editingMessageId !== m.id && (
                    <button className="edit-msg-btn" onClick={() => startEditing(m.id, m.text)}>✏️</button>
                  )}
                </div>
                <div className="msg-text">
                  {editingMessageId === m.id ? (
                    <div className="edit-mode">
                      <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="edit-textarea" rows={4} />
                      <div className="edit-actions">
                        <button onClick={() => setEditingMessageId(null)}>Cancel</button>
                        <button onClick={() => saveEditedMessage(m.id, idx)}>Save & Resend</button>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown components={{
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter style={theme === 'dark' ? vscDarkPlus : vs} language={match[1]} PreTag="div" {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : <code className={className} {...props}>{children}</code>;
                      }
                    }}>{m.text}</ReactMarkdown>
                  )}
                </div>
                <div className="msg-actions">
                  <button onClick={() => copyToClipboard(m.text)}>📋 Copy</button>
                  <button onClick={() => textToSpeech(m.text)}>🔊 Listen</button>
                  {m.role === 'model' && <button onClick={() => regenerateMessage(idx)}>🔄 Regenerate</button>}
                </div>
              </div>
            </div>
          ))}
          
          {(loading || analyzingImage) && (
            <div className="typing-loader">
              <div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div>
              <span>{analyzingImage ? 'Analyzing image...' : (fileContent ? 'Analyzing file...' : 'Thinking...')}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>
        
        <footer className="input-footer">
          <div className="input-wrapper-pill">
            <div className="plus-container" ref={plusMenuRef}>
              <button className="plus-btn" onClick={() => setShowPlusMenu(!showPlusMenu)}>+</button>
              {showPlusMenu && (
                <div className="plus-floating-menu">
                  <button onClick={() => { fileInputRef.current.click(); setShowPlusMenu(false); }}>📷 Upload Image</button>
                  <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => onImageSelect(e.target.files[0]); input.click(); setShowPlusMenu(false); }}>📸 Take Photo</button>
                  <button onClick={() => { fileInputRef.current.click(); setShowPlusMenu(false); }}>📄 Upload PDF</button>
                  <button onClick={() => { fileInputRef.current.click(); setShowPlusMenu(false); }}>📁 Upload File (TXT, JSON, CSV)</button>
                  <button onClick={() => { setShowToolsMenu(!showToolsMenu); setShowPlusMenu(false); }}>⚡ AI Tools</button>
                </div>
              )}
              {showToolsMenu && (
                <div className="tools-floating-menu">
                  <button onClick={() => tools.createImage(input || "a beautiful scene")}>🎨 Create Image</button>
                  <button onClick={() => tools.deepSearch(input || "latest AI trends")}>🔍 Deep Search</button>
                  <button onClick={() => tools.generateCode(input || "a React component")}>💻 Generate Code</button>
                </div>
              )}
            </div>
            
            <input type="file" ref={fileInputRef} hidden accept="image/*,.txt,.csv,.json,.js,.py,.html,.css,.xml,.pdf" onChange={(e) => {
              const file = e.target.files[0];
              if (file.type.startsWith('image/')) onImageSelect(file);
              else handleFileUpload(file);
            }} />
            
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && input.trim() && !isGenerating && handleSend()}
              placeholder={uploadedFile ? `Ask a question about "${fileName}"...` : "Ask me anything..."}
              className="message-input"
            />
            <button className={`send-btn ${isGenerating ? 'stop-btn' : ''}`} 
              onClick={() => isGenerating ? stopGeneration() : handleSend()} 
              disabled={!input.trim() && !isGenerating}>
              {isGenerating ? '⏹️' : '➤'}
            </button>
          </div>
          <div className="footer-note">
            <span>🤖 <strong>Ayoub AI Pro</strong> — Powered by Google Gemini | Created by Ayoub</span>
          </div>
        </footer>
      </main>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay-pro" onClick={() => setShowSettings(false)}>
          <div className="settings-modal-v2" onClick={e => e.stopPropagation()}>
            <div className="modal-sidebar">
              <button className={activeSettingsTab === 'general' ? 'active' : ''} onClick={() => setActiveSettingsTab('general')}>⚙️ General</button>
              <button className={activeSettingsTab === 'appearance' ? 'active' : ''} onClick={() => setActiveSettingsTab('appearance')}>🎨 Appearance</button>
              <button className={activeSettingsTab === 'data' ? 'active' : ''} onClick={() => setActiveSettingsTab('data')}>💾 Data</button>
              <button className={activeSettingsTab === 'about' ? 'active' : ''} onClick={() => setActiveSettingsTab('about')}>ℹ️ About</button>
            </div>
            <div className="modal-main">
              {activeSettingsTab === 'general' && (
                <>
                  <h3>General Settings</h3>
                  <div className="s-row">
                    <label>🤖 AI Model</label>
                    <select className="settings-select" value={model} onChange={(e) => setModel(e.target.value)}>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                      <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                    </select>
                  </div>
                  <div className="s-row">
                    <label>📱 Install App</label>
                    <button className="install-btn-action" onClick={installApp}>📲 Install PWA</button>
                  </div>
                </>
              )}
              {activeSettingsTab === 'appearance' && (
                <>
                  <h3>Appearance</h3>
                  <div className="s-row">
                    <label>🌓 Theme</label>
                    <div className="theme-toggle">
                      <button onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}>Light</button>
                      <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}>Dark</button>
                    </div>
                  </div>
                  <div className="s-row">
                    <label>🔤 Font Size ({fontSize}px)</label>
                    <input type="range" min="12" max="24" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} />
                  </div>
                </>
              )}
              {activeSettingsTab === 'data' && (
                <>
                  <h3>Data Management</h3>
                  <div className="s-row">
                    <label>💾 Export Data</label>
                    <button className="export-data-btn" onClick={exportChatAsTXT}>Export as TXT</button>
                  </div>
                  <div className="s-row">
                    <label>🗑️ Delete All Data</label>
                    <button className="delete-chats" onClick={() => {
                      if(window.confirm('Delete ALL conversations?')) {
                        setConversationHistory([]);
                        newConversation();
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}>Delete Everything</button>
                  </div>
                </>
              )}
              {activeSettingsTab === 'about' && (
                <>
                  <h3>About Ayoub AI</h3>
                  <div className="about-section-full">
                    <div className="about-icon">🤖</div>
                    <h4>Ayoub AI Pro <span className="version">v27.0</span></h4>
                    <p>Powered by <strong>Google Gemini API</strong> (Free Tier)</p>
                    <p>Created by <strong>Ayoub</strong> - Computer Science Engineer</p>
                    <div className="about-features">
                      <span>✅ Markdown</span><span>✅ Code Highlight</span><span>✅ Voice Input</span>
                      <span>✅ Image Analysis</span><span>✅ PDF Upload</span><span>✅ File Upload</span>
                      <span>✅ Ask Questions on Files</span><span>✅ Clear File</span><span>✅ PWA Ready</span>
                      <span>✅ Pin/Unpin</span><span>✅ Rename Chats</span><span>✅ Search History</span>
                      <span>✅ Export Chat</span><span>✅ Google Auth</span><span>✅ Stop Generation</span>
                      <span>✅ Edit Message</span><span>✅ AI Tools</span>
                    </div>
                    <small>© 2025 Ayoub AI - All rights reserved</small>
                  </div>
                </>
              )}
              <button className="close-final" onClick={() => setShowSettings(false)}>✓ Done</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="login-header"><h2>Ayoub AI</h2><button onClick={() => setShowLoginModal(false)}>✕</button></div>
            <div className="login-options">
              <button className="login-google" onClick={handleGoogleLogin}><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" />Continue with Google</button>
              <button className="login-guest" onClick={handleGuestLogin}>🚪 Continue as Guest</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Image Modal */}
      {showImageModal && imagePreview && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal" onClick={e => e.stopPropagation()}>
            <div className="image-modal-header"><h3>📷 Analyze Image</h3><button onClick={() => setShowImageModal(false)}>✕</button></div>
            <div className="image-modal-preview"><img src={URL.createObjectURL(imagePreview)} alt="Preview" /></div>
            <div className="image-modal-input">
              <input type="text" placeholder="Ask about this image..." value={imageQuestion} onChange={(e) => setImageQuestion(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleImageWithQuestion(imagePreview, imageQuestion)} autoFocus />
            </div>
            <div className="image-modal-actions">
              <button className="cancel-btn" onClick={() => setShowImageModal(false)}>Cancel</button>
              <button className="analyze-btn" onClick={() => handleImageWithQuestion(imagePreview, imageQuestion)}>🔍 Analyze</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
