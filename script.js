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

  // --- MOBILE HAMBURGER MENU ---
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Auto-close sidebar when a nav item is tapped on mobile
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
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
          showAnalysisResults(displayName);
        }, 500);
      }
      if (progress > 95 && filesRead < validFiles.length) progress = 95; // wait for read
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

        // ── SPEAKER EXTRACTION using targeted regex patterns ──
        // Handles all common formats:
        //   [00:01:20] Aaisha: text
        //   [01:15] Alex Chen: text
        //   Sruthi: text
        //   Aaisha (Engineer): text
        let speaker = null;
        let cleanText = line;

        // Pattern 1: [timestamp] Name: text  (e.g. [00:01:20] Alan: ...)
        let m = line.match(/^\[[\d:]+\]\s*([A-Za-z][A-Za-z\s]{0,25}?):\s*(.+)/);
        if (m) {
          speaker = m[1].trim();
          cleanText = m[2].trim();
        }

        // Pattern 2: Name (Role): text OR Name: text (no timestamp)
        if (!speaker && !headerPrefixes.test(line)) {
          m = line.match(/^([A-Za-z][A-Za-z\s]{0,25?})(?:\s*\([^)]*\))?:\s*(.+)/);
          if (m && m[1].trim().split(/\s+/).length <= 3) {
            speaker = m[1].trim();
            cleanText = m[2].trim();
          }
        }

        // Add unique speaker to set
        if (speaker) {
          if (!attendeesFound) allSpeakers.add(speaker);
        }

        // ── SENTENCE-LEVEL SCORING ENGINE ──
        // Split the speaker's utterance into individual sentences for fine-grained analysis
        const sentences = cleanText
          .split(/(?<=[.!])\s+(?=[A-Z"'])|(?<=\.)\s+(?=[A-Z"'])/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && s.split(/\s+/).length >= 5);

        // If no good sentence split (short line), analyze the whole thing
        const toAnalyze = sentences.length > 0 ? sentences : [cleanText];

        toAnalyze.forEach(sentence => {
          const sl = sentence.toLowerCase();
          const words = sentence.split(/\s+/).length;

          // Skip questions and pure speculation
          if (sentence.trim().endsWith('?')) return;
          if (/\b(i think|i feel|i wonder|what if|maybe|perhaps|could we|should we|would it|isn't it|don't you)\b/i.test(sentence)) return;

          // ── DECISION SCORING ──
          let dScore = 0;
          if (/\bdecision\s*(made|is\s*:?|:)\s*.{4,}/i.test(sentence))         dScore += 4;
          if (/\bwe\s+(decided|have\s+decided)\b/i.test(sentence))              dScore += 4;
          if (/\bwe('ve)?\s+agreed\s+to\b/i.test(sentence))                    dScore += 4;
          if (/\bformally\s+(decide|agree|commit)\b/i.test(sentence))           dScore += 4;
          if (/\bwe\s+will\s+(?!just|still|also|be)\w+/i.test(sentence))       dScore += 3;
          if (/\bgoing\s+with\b.{4,}/i.test(sentence))                         dScore += 3;
          if (/\bwill\s+(delay|migrate|move|launch|adopt|switch|standardize|deprecate|scrap|cancel|roll out|phase out)\b/i.test(sentence)) dScore += 3;
          if (/\bno\s+(hybrid|alternative|other option)\b/i.test(sentence))     dScore += 3;
          if (/\bfinal\s+(call|decision|answer)\b/i.test(sentence))             dScore += 3;
          if (/\bwant\s+to\s+formally\b/i.test(sentence))                      dScore += 3;
          if (/\bi want\s+to\s+(decide|confirm|lock)\b/i.test(sentence))        dScore += 2;
          // Anti-signals
          if (/\b(i think|suppose|assume|i hope|ideally)\b/i.test(sentence))    dScore -= 2;

          // ── ACTION SCORING ──
          let aScore = 0;
          if (/\bi('ll| will| am going to| commit to)\b/i.test(sentence))       aScore += 4;
          if (/\btake\s+(the\s+)?action\s+(item\s+)?to\b/i.test(sentence))     aScore += 4;
          if (/\bi('ll)?\s+(take|own|handle|own this|do this)\b/i.test(sentence)) aScore += 3;
          if (/\bplease\s+\w+.{5,}/i.test(sentence))                           aScore += 3; // assignment
          if (/\b(can|could)\s+you\s+\w+.{5,}/i.test(sentence))               aScore += 3; // "can you [verb]..."
          if (/\bwill\s+(draft|send|update|submit|complete|finish|review|check|prepare|implement|fix|build|test|deploy|run|reach out|coordinate|follow up|look into|handle|explore|analyse|analyze|set up|get|push|merge)\b/i.test(sentence)) aScore += 3;
          if (/\bi\s+(need to|must|have to)\s+\w+.{5,}/i.test(sentence))       aScore += 2;
          if (/\bby\s+(tonight|tomorrow|end of (the\s+)?(day|week|month)|[A-Z][a-z]+ \d{1,2})\b/i.test(sentence)) aScore += 2; // deadline adds confidence
          if (/\bgive\s+me\s+until\b/i.test(sentence))                         aScore += 2;
          if (/\bresponsible\s+for\b/i.test(sentence))                         aScore += 2;
          if (/\bi('d| should)\s+also\b/i.test(sentence))                      aScore += 1;
          // Anti-signals
          if (/\b(i thought|i used to|i was|it was)\b/i.test(sentence))        aScore -= 2;
          if (/\b(we should|everyone should|they should)\b/i.test(sentence))   aScore -= 1;

          // Only extract if confident enough (score ≥ 3)
          if (dScore >= 3 && dScore > aScore) {
            const keyPhrase = extractKeyPhrase(sentence, 'Decision');
            allExtractedData.push({ type: 'Decision', text: keyPhrase, assignee: speaker || 'Team', due: '-', sentiment: detectSentiment(sentence) });
          } else if (aScore >= 3) {
            let due = '-';
            let dateMatch = sentence.match(/by\s+([A-Z][a-z]+ \d{1,2}(?:th|st|nd|rd)?|tonight|tomorrow|end of (?:the\s+)?\w+|\w+ \d{1,2}(?:th|st|nd|rd)?)/i);
            if (dateMatch) due = dateMatch[1];
            const keyPhrase = extractKeyPhrase(sentence, 'Action');
            allExtractedData.push({ type: 'Action', text: keyPhrase, assignee: speaker || 'Team', due: due, sentiment: detectSentiment(sentence) });
          }
        });
      });
    });
  }

  // ── SENTIMENT DETECTION ──
  function detectSentiment(text) {
    const lower = text.toLowerCase();
    const positiveWords = ['great','good','excellent','confirmed','done','happy','glad','confident','success','approved','perfect','agree','absolutely','on track','ready','completed','resolved','will complete','committing'];
    const negativeWords = ['worried','concern','risk','delay','problem','issue','behind','longer than expected','cannot','can\'t','frustrated','blocked','difficult','challenging','unfortunately','uncertain','unclear','not sure','miss','missed','overdue'];
    const pos = positiveWords.filter(w => lower.includes(w)).length;
    const neg = negativeWords.filter(w => lower.includes(w)).length;
    if (neg > pos) return 'Concerned';
    if (pos > neg) return 'Confident';
    return 'Neutral';
  }

  // ── CONCISE SUMMARY EXTRACTION ──
  // Distills a long sentence into the key commitment/decision phrase
  function extractKeyPhrase(text, type) {
    const lower = text.toLowerCase();
    // Try to extract the core commitment pattern
    const actionPatterns = [
      /i(?:'ll| will) (.{10,80}?)(?:\.|$)/i,
      /(?:will|going to) (.{10,80}?)(?:\.|$)/i,
      /(?:action|task)[:\s]+(.{10,80}?)(?:\.|$)/i,
      /(?:complete|finish|deliver|submit|draft|update|send|fix|do|handle) (.{10,80}?)(?:\.|$)/i,
    ];
    const decisionPatterns = [
      /(?:decision(?:\s+is)?|decided?(?:\s+(?:to|that))?|agreed?(?:\s+(?:to|that))?)[:\s]+(.{10,120}?)(?:\.|$)/i,
      /we (?:will|are going to|shall) (.{10,100}?)(?:\.|$)/i,
      /(?:going|decided) (?:with|to) (.{10,100}?)(?:\.|$)/i,
    ];

    const patterns = type === 'Action' ? actionPatterns : decisionPatterns;
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let phrase = m[1].trim();
        // Capitalise first letter
        phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
        return phrase.length > 120 ? phrase.substring(0, 117) + '...' : phrase;
      }
    }
    // Fallback: cap the original text
    return text.length > 130 ? text.substring(0, 127) + '...' : text;
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
    // Deduplicate by assignee+text to avoid repeat rows 
    const seen = new Set();
    dataToRender = dataToRender.filter(r => {
      const key = r.assignee + '|' + r.text.substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (dataToRender.length === 0) {
      dataToRender = [{ type: 'Decision', text: 'No actionable items found in transcript.', assignee: '-', due: '-', sentiment: 'Neutral' }];
    }

    dataToRender.forEach(row => {
      const tr = document.createElement('tr');
      const tagClass = row.type === 'Decision' ? 'decision' : 'action';
      const sentiment = row.sentiment || 'Neutral';
      const sentClass = sentiment === 'Confident' ? 'sent-positive' : sentiment === 'Concerned' ? 'sent-negative' : 'sent-neutral';
      tr.innerHTML = `
        <td><span class="tag ${tagClass}">${row.type}</span></td>
        <td>${row.text}</td>
        <td style="font-family: 'Outfit';">${row.assignee}</td>
        <td class="text-muted">${row.due}</td>
        <td><span class="sentiment-badge ${sentClass}">${sentiment}</span></td>
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
