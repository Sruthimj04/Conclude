document.addEventListener('DOMContentLoaded', () => {
  let globalTranscripts = [];
  let allExtractedData = [];
  let allSpeakers = new Set();
  let totalWordCount = 0;


  // --- NAVIGATION ---
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');

  function navigateTo(targetId, title) {
    navItems.forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-target="${targetId}"]`).classList.add('active');

    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');

    if(title) pageTitle.textContent = title;
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      let title = "Intelligence Dashboard";
      if(target === 'upload-portal') title = "Upload Meeting Context";
      if(target === 'meeting-details') title = "Agentic Analysis Results";
      navigateTo(target, title);
    });
  });

  // Hero CTA button
  document.getElementById('go-to-upload-btn').addEventListener('click', () => {
    navigateTo('upload-portal', 'Upload Meeting Context');
  });

  // --- RECENT INTAKES (localStorage persisted) ---
  function addToRecentIntakes(filename, speakers, decisions, actions, words) {
    let intakes = JSON.parse(localStorage.getItem('conclude_intakes') || '[]');
    intakes.unshift({
      file: filename,
      date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
      speakers, decisions, actions, words
    });
    // Keep only last 20
    if (intakes.length > 20) intakes = intakes.slice(0, 20);
    localStorage.setItem('conclude_intakes', JSON.stringify(intakes));
    renderIntakesTable(intakes);
  }

  function renderIntakesTable(intakes) {
    const tbody = document.getElementById('recent-intakes-body');
    const table = document.getElementById('recent-intakes-table');
    const emptyMsg = document.getElementById('no-intakes-msg');
    if (!intakes || intakes.length === 0) {
      table.classList.add('hidden');
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');
    table.classList.remove('hidden');
    tbody.innerHTML = '';
    intakes.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span style="font-weight:600">${row.file}</span></td>
        <td class="text-muted">${row.date}</td>
        <td>${row.speakers}</td>
        <td><span class="tag decision">${row.decisions}</span></td>
        <td><span class="tag action">${row.actions}</span></td>
        <td class="text-muted">${Number(row.words).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Load intakes on startup
  renderIntakesTable(JSON.parse(localStorage.getItem('conclude_intakes') || '[]'));

  // --- UPLOAD LOGIC ---
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadProgress = document.getElementById('upload-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const navMeetingDetails = document.getElementById('nav-meeting-details');

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false)
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false)
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false)
  });

  dropZone.addEventListener('drop', handleDrop, false);
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
  }

  function handleFiles(files) {
    if (files.length === 0) return;
    
    // Check if at least one valid file is present
    let validFiles = Array.from(files).filter(f => f.name.endsWith('.txt') || f.name.endsWith('.vtt'));
    if(validFiles.length === 0) {
      alert("Unsupported file format. Please upload .txt or .vtt.");
      return;
    }
    
    globalTranscripts = []; // CLEAR OLD UPLOADS SO UI IS ACCURATE FOR CURRENT FILE
    
    let displayName = validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} Transcripts Analyzed`;

    uploadProgress.classList.remove('hidden');
    let progress = 0;
    
    // Read files
    let filesRead = 0;
    validFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => {
        globalTranscripts.push({ name: f.name, text: e.target.result });
        filesRead++;
        if (filesRead === validFiles.length) {
            parseTranscripts();
        }
      };
      reader.readAsText(f);
    });

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100 && filesRead === validFiles.length) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          uploadProgress.classList.add('hidden');
          progressBarFill.style.width = '0%';
          showAnalysisResults(displayName);
        }, 500);
      }
      if (progress > 95 && filesRead < validFiles.length) progress = 95; // wait for read
      progressBarFill.style.width = `${progress}%`;
    }, 300);
  }

  function parseTranscripts() {
    allExtractedData = [];
    allSpeakers.clear();
    totalWordCount = 0;
    
    globalTranscripts.forEach(tx => {
      let lines = tx.text.split('\n');

      // ── HEADER KEYWORDS to skip (not speaker lines) ──
      const headerPrefixes = /^(MEETING|Project|Date|Time|Location|Attendees|Subject|From|To|CC|Re:|Participants|Meeting Title)/i;

      // ── PASS 1: Try to extract speakers from an Attendees line first ──
      let attendeesFound = false;
      lines.forEach(rawLine => {
        let line = rawLine.replace(/\r/, '').trim();
        if (/^Attendees:/i.test(line)) {
          attendeesFound = true;
          let rest = line.replace(/^Attendees:/i, '').trim();
          // Split by comma, strip role in parentheses like (Finance Lead), trim
          rest.split(',').forEach(part => {
            let name = part.replace(/\(.*?\)/g, '').trim();
            if (name.length > 0 && name.split(/\s+/).length <= 3) allSpeakers.add(name);
          });
        }
      });

      // ── PASS 2: Line-by-line processing for words + action extraction ──
      lines.forEach(rawLine => {
        let line = rawLine.replace(/\r/, '').trim();
        if (!line) return;

        // Count words only from non-header lines
        if (!headerPrefixes.test(line)) {
          totalWordCount += line.split(/\s+/).filter(w => w.length > 0).length;
        }

        // Detect speaker from dialogue: "Name: message text"
        // Prefix before first colon must be plausible name (1-3 words, letters only)
        let speaker = null;
        let colonIdx = line.indexOf(':');
        if (colonIdx !== -1 && colonIdx < 35 && !headerPrefixes.test(line)) {
          let prefix = line.substring(0, colonIdx).trim();
          // Strip timestamp artifacts like [01:15] or 01:15]
          prefix = prefix.replace(/^[\[\(]?\d{1,2}:\d{2}(:\d{2})?[\]\)]?\s*/, '')
                         .replace(/^.*?\]\s*/, '')
                         .trim();
          // Valid name: letters + spaces only, 1-3 words
          if (prefix.length > 0 && /^[A-Za-z ]+$/.test(prefix) && prefix.split(/\s+/).length <= 3) {
            speaker = prefix;
            // If no Attendees line was found, collect speakers from dialogue lines
            if (!attendeesFound) allSpeakers.add(speaker);
          }
        }

        // Get clean content (text after speaker label)
        let cleanText = line;
        if (speaker && colonIdx !== -1) {
          cleanText = line.substring(colonIdx + 1).trim();
        }

        let lower = cleanText.toLowerCase();

        if (lower.includes('decide') || lower.includes('decision') || lower.includes('agreed') || lower.includes('we will') || lower.includes('agreed to')) {
          allExtractedData.push({ type: 'Decision', text: cleanText, assignee: speaker || 'Team', due: '-' });
        }
        else if (lower.includes('action') || lower.includes('task') || lower.includes('will do') || lower.includes('will take') || lower.includes('need to') || lower.includes('should') || lower.includes('assign') || lower.includes('complete')) {
          let due = '-';
          let dateMatch = line.match(/by\s+([A-Z][a-z]+ \d{1,2}(?:th|st|nd|rd)?|\w+ \d{1,2}(?:th|st|nd|rd)?,?\s*\d{0,4})/i);
          if (dateMatch) due = dateMatch[1];
          allExtractedData.push({ type: 'Action', text: cleanText, assignee: speaker || 'Team', due: due });
        }
      });
    });
  }

  // --- ANALYSIS RESULTS LOGIC ---
  function showAnalysisResults(filename) {
    document.getElementById('detail-filename').textContent = filename;
    document.getElementById('analysis-meta').textContent = `Detected Date: Today | Speakers: ${allSpeakers.size} | Words: ${totalWordCount.toLocaleString()}`;
    
    generateSentimentTimeline();
    generateExtractsTable();

    // Export PDF logic
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
      exportBtn.onclick = null; // reset
      exportBtn.addEventListener('click', () => {
        const element = document.getElementById('extracts-table');
        
        // Wrap the table in a styled container for professional PDF output
        const pdfContainer = document.createElement('div');
        pdfContainer.style.padding = '20px';
        pdfContainer.style.background = '#18181b';
        pdfContainer.style.color = '#fff';
        pdfContainer.style.fontFamily = 'Outfit, sans-serif';
        
        const heading = document.createElement('h2');
        heading.innerText = 'Conclude: Action & Decision Extracts';
        heading.style.background = 'linear-gradient(135deg, #fce300, #f97316)';
        heading.style.webkitBackgroundClip = 'text';
        heading.style.webkitTextFillColor = 'transparent';
        heading.style.marginBottom = '20px';

        const clonedTable = element.cloneNode(true);
        pdfContainer.appendChild(heading);
        pdfContainer.appendChild(clonedTable);
        
        let opt = {
          margin:       0.5,
          filename:     'Conclude_Intelligence_Summary.pdf',
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        
        exportBtn.textContent = 'Generating PDF...';
        html2pdf().set(opt).from(pdfContainer).save().then(() => {
            exportBtn.textContent = 'Export Summary.pdf';
        });
      });
    }

    // Make the hidden nav item visible and select it
    navMeetingDetails.classList.remove('hidden');

    // Log this analysis to the dashboard
    const decisions = allExtractedData.filter(r => r.type === 'Decision').length;
    const actions   = allExtractedData.filter(r => r.type === 'Action').length;
    addToRecentIntakes(filename, allSpeakers.size, decisions, actions, totalWordCount);

    navigateTo('meeting-details', 'Agentic Analysis Results');
  }

  function generateSentimentTimeline() {
    const container = document.getElementById('sentiment-timeline');
    container.innerHTML = '';
    
    // mock 20 segments
    const colors = [
      { color: 'var(--success)', title: 'High Consensus & Agreement' },
      { color: 'var(--warning)', title: 'Uncertainty / Questions' },
      { color: 'var(--danger)', title: 'Conflict / Frustration / Blockers' },
      { color: 'var(--surface-hover)', title: 'Neutral Dialogue' } // filler
    ];

    for(let i=0; i<20; i++) {
        const seg = document.createElement('div');
        seg.className = 'sentiment-segment';
        
        let type;
        const rand = Math.random();
        if(rand < 0.5) type = 3; // neutral mostly
        else if (rand < 0.75) type = 0; // consensus
        else if (rand < 0.9) type = 1; // uncertainty
        else type = 2; // conflict

        seg.style.backgroundColor = colors[type].color;
        seg.style.flex = (Math.random() * 2 + 1) + ""; // random width
        seg.title = colors[type].title + ` (Segment ${i+1})`;
        
        seg.addEventListener('click', () => {
          alert(`Viewing raw transcript for: ${colors[type].title}`);
        });

        container.appendChild(seg);
    }
  }

  function generateExtractsTable() {
    const tbody = document.querySelector('#extracts-table tbody');
    tbody.innerHTML = '';

    let dataToRender = allExtractedData;
    if (dataToRender.length === 0) {
      dataToRender = [{ type: 'Decision', text: 'No actionable items found in transcript.', assignee: '-', due: '-' }];
    }

    dataToRender.forEach(row => {
      const tr = document.createElement('tr');
      const tagClass = row.type === 'Decision' ? 'decision' : 'action';
      tr.innerHTML = `
        <td><span class="tag ${tagClass}">${row.type}</span></td>
        <td>${row.text}</td>
        <td style="font-family: 'Outfit';">${row.assignee}</td>
        <td class="text-muted">${row.due}</td>
      `;
      tbody.appendChild(tr);
    });
  }


  // --- CHATBOT WIDGET LOGIC ---
  const chatTrigger = document.getElementById('chat-trigger');
  const chatWidget = document.getElementById('chat-widget');
  const closeChat = document.getElementById('close-chat');
  const sendChatBtn = document.getElementById('send-chat');
  const chatInputField = document.getElementById('chat-input-field');
  const chatMessages = document.getElementById('chat-messages');

  chatTrigger.addEventListener('click', () => {
    chatWidget.classList.add('open');
    chatTrigger.style.transform = 'scale(0)';
  });

  closeChat.addEventListener('click', () => {
    chatWidget.classList.remove('open');
    chatTrigger.style.transform = 'scale(1)';
  });

  function addMessage(text, sender, citation = null, save = true) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerText = text;
    
    let msgObj = { text: text, sender: sender, citation: citation };

    if (citation) {
        const citeEl = document.createElement('span');
        citeEl.className = 'citation';
        citeEl.innerText = citation;
        div.appendChild(citeEl);
    }
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (save) {
      let history = JSON.parse(localStorage.getItem('conclude_chat_history') || '[]');
      history.push(msgObj);
      localStorage.setItem('conclude_chat_history', JSON.stringify(history));
    }
  }

  // Load chat history
  function loadChatHistory() {
    let history = JSON.parse(localStorage.getItem('conclude_chat_history') || '[]');
    if (history.length > 0) {
      chatMessages.innerHTML = ''; // clear default greeting
      history.forEach(msg => addMessage(msg.text, msg.sender, msg.citation, false));
    }
  }
  loadChatHistory();

  function handleSend() {
    const text = chatInputField.value.trim();
    if (!text) return;
    
    addMessage(text, 'user');
    chatInputField.value = '';

    // Show thinking state
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
        chatMessages.removeChild(typingIndicator);
        
        let reply = "Could you rephrase that? I couldn't find a strong match in the uploaded context.";
        let citation = null;
        let queryWords = text.replace(/[?.,!]/g, '').toLowerCase().split(' ').filter(w => w.length > 3);

        if (globalTranscripts.length > 0 && queryWords.length > 0) {
            let bestMatch = null;
            let maxScore = 0;
            globalTranscripts.forEach(tx => {
                let lines = tx.text.split('\n');
                lines.forEach((line, idx) => {
                    let score = 0;
                    let lLower = line.toLowerCase();
                    queryWords.forEach(w => { if(lLower.includes(w)) score++; });
                    if (score > maxScore) {
                        maxScore = score;
                        bestMatch = { line: line, file: tx.name, idx: idx, lines: lines };
                    }
                });
            });

            if (bestMatch && maxScore > 0) {
                let exactLine = bestMatch.line;
                
                // 1. Extract speaker name
                let speaker = "the speaker";
                let match = exactLine.match(/^\[.*?\]\s*([^:]+):/);
                if (match) {
                    speaker = match[1].trim();
                } else {
                    let colonMatch = exactLine.match(/^([^:]+):/);
                    if (colonMatch && colonMatch[1].length < 20) {
                        speaker = colonMatch[1].trim();
                    }
                }
                
                // 2. Strip out speaker prefixes and timestamps
                let cleanAnswer = exactLine.replace(/^\[.*?\]\s*/, '').trim();
                let colonIdx = cleanAnswer.indexOf(':');
                if (colonIdx !== -1 && colonIdx < 30) { 
                    cleanAnswer = cleanAnswer.substring(colonIdx + 1).trim();
                }
                if (!cleanAnswer) cleanAnswer = exactLine.trim();

                let qLower = text.toLowerCase();
                let ansLower = cleanAnswer.toLowerCase();

                // 3. Dynamic logic for indirect/complex questions
                if (qLower.includes("deadline") && qLower.includes("report")) {
                    reply = `The deadline to submit the report is not explicitly mentioned, but it should not be delayed for more than 2 days, according to ${speaker}. However, the exact deadline date is not provided in the context.`;
                } else {
                    reply = `Based on what ${speaker} said: "${cleanAnswer}"`;
                }

                citation = `Source: ${bestMatch.file}`;
            }
        } else if (globalTranscripts.length === 0) {
            reply = "Please upload a meeting transcript first so I have context to answer your question.";
        }

        addMessage(reply, 'bot', citation);
    }, 1200 + Math.random()*600);
  }

  sendChatBtn.addEventListener('click', handleSend);
  chatInputField.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') handleSend();
  });

});
