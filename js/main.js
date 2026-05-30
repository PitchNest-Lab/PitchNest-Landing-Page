document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  //   1. THEME TOGGLER (SYNCED STATE)
  // ==========================================
  const themeToggleBtn = document.getElementById('theme-toggle');
  
  if (themeToggleBtn) {
    const savedTheme = localStorage.getItem('pitchnest_theme');
    
    // Landing page defaults to DARK, Onboarding defaults to LIGHT
    const isSurveyPage = window.location.pathname.includes('survey.html');
    
    const applyTheme = (theme) => {
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
      }
    };
    
    if (savedTheme === 'light') {
      applyTheme('light');
    } else if (savedTheme === 'dark') {
      applyTheme('dark');
    } else {
      // No preference saved:
      if (isSurveyPage) {
        applyTheme('light'); // Survey page defaults to light
      } else {
        applyTheme('dark'); // Landing page defaults to dark
      }
    }

    themeToggleBtn.addEventListener('click', () => {
      if (document.body.classList.contains('light-theme')) {
        applyTheme('dark');
        localStorage.setItem('pitchnest_theme', 'dark');
      } else {
        applyTheme('light');
        localStorage.setItem('pitchnest_theme', 'light');
      }
    });
  }

  // ==========================================
  //   2. SCROLL REVEAL OBSERVER
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    root: null,
    threshold: 0.08,
    rootMargin: "0px 0px -40px 0px"
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  //   3. NAVBAR SCROLL EFFECT
  // ==========================================
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const checkScroll = () => {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Check on load
  }

  // ==========================================
  //   4. TESTIMONIALS CAROUSEL
  // ==========================================
  const track = document.getElementById('testimonials-track');
  const dotsContainer = document.getElementById('carousel-dots');
  
  if (track && dotsContainer) {
    const cards = Array.from(track.children);
    
    // Create dots
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    });
    
    const dots = Array.from(dotsContainer.children);
    let currentIndex = 0;
    
    function goToSlide(index) {
      if (index < 0 || index >= cards.length) return;
      currentIndex = index;
      const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
      const cardWidth = cards[0].getBoundingClientRect().width + gap;
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
      
      dots.forEach(d => d.classList.remove('active'));
      dots[currentIndex].classList.add('active');
    }
    
    // Auto advance
    let autoPlayInterval = setInterval(() => {
      let nextIndex = (currentIndex + 1) % cards.length;
      goToSlide(nextIndex);
    }, 4500);
    
    // Pause on hover
    track.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    track.addEventListener('mouseleave', () => {
      autoPlayInterval = setInterval(() => {
        let nextIndex = (currentIndex + 1) % cards.length;
        goToSlide(nextIndex);
      }, 4500);
    });
    
    // Swipe mechanics
    let startX = 0;
    let isDragging = false;
    
    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      clearInterval(autoPlayInterval);
    }, {passive: true});
    
    track.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
    }, {passive: true});
    
    track.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const endX = e.changedTouches[0].clientX;
      const diffX = startX - endX;
      
      if (diffX > 50) {
        goToSlide(Math.min(currentIndex + 1, cards.length - 1));
      } else if (diffX < -50) {
        goToSlide(Math.max(currentIndex - 1, 0));
      }
      
      autoPlayInterval = setInterval(() => {
        let nextIndex = (currentIndex + 1) % cards.length;
        goToSlide(nextIndex);
      }, 4500);
    });
  }

  // ==========================================
  //   5. AI INVESTMENT COMMITTEE INTERACTION
  // ==========================================
  const investorPills = document.querySelectorAll('.investor-pill');
  const activeVcTitle = document.getElementById('active-vc-title');
  const activeVcSub = document.getElementById('active-vc-sub');
  const activeVcSentiment = document.getElementById('active-vc-sentiment');
  const chatMessagesContainer = document.getElementById('chat-messages-container');

  // Debates datasets
  const vcDebates = {
    arthur: {
      name: "Arthur Vance",
      role: "Aggressive VC Perspective",
      sub: "Debating: TAM & Revenue Defensibility",
      sentimentClass: "sentiment-pass",
      sentimentText: "Arthur Vote: Pass",
      message: "Look, the founder story is high energy, but let's look at the cold hard facts. The TAM calculations are heavily inflated by assuming adjacent markets they can't realistically acquire in year 1. Unless they can prove customer acquisition costs scale down dramatically, this unit economic model is broken. I'm voting Pass.",
      advice: "Arthur is heavily concerned about CAC and TAM calculations. To counter this, present your cohort retention rates and show detailed GTM partnerships that validate organic acquisition growth."
    },
    sarah: {
      name: "Sarah Jenkins",
      role: "Angel Investor Perspective",
      sub: "Debating: Customer Delight & Early Traction",
      sentimentClass: "sentiment-invest",
      sentimentText: "Sarah Vote: Invest",
      message: "I disagree with Arthur. Look at the early pilot cohorts! 42% week-12 retention is something you rarely see in pre-seed. The users aren't just using it; they are raving about it on social channels. This organic pull is real and indicates a deep product-market fit. I'm a strong Invest.",
      advice: "Sarah values user traction and viral metrics. Highlight customer testimonials, Net Promoter Score (NPS), and case studies showing outcomes to strengthen her conviction."
    },
    ken: {
      name: "Dr. Ken Tanaka",
      role: "Technical VC Perspective",
      sub: "Debating: Defensibility & Moat Depth",
      sentimentClass: "sentiment-maybe",
      sentimentText: "Ken Vote: Maybe",
      message: "Technically, the architecture is clean, but is it a moat? Right now it looks like an API wrapper built on standard models. However, their custom caching layer and search index algorithms do show a path towards true proprietary IP. If they can detail their data training strategy, I can shift from Maybe to Invest.",
      advice: "Ken is checking for technical moat and defensibility. Pivot your response to show proprietary vector embeddings, data processing pipelines, or custom fine-tuned model architectures."
    },
    elena: {
      name: "Elena Rostova",
      role: "Skeptical Partner Perspective",
      sub: "Debating: Monetization Risks & Expansion",
      sentimentClass: "sentiment-maybe",
      sentimentText: "Elena Vote: Maybe",
      message: "The margins look good on paper, but I'm worried about supply-side churn. In digital simulation networks, if user density drops off due to low early engagement, the platform value collapses. They need a localized density model. It's a Maybe for me.",
      advice: "Elena is focused on monetization, supply-side churn, and scaling risks. Answer her by presenting host-acquisition subsidies or locked-in B2B commercial agreements."
    }
  };

  if (investorPills.length > 0 && chatMessagesContainer) {
    investorPills.forEach(pill => {
      pill.addEventListener('click', () => {
        // Remove active class
        investorPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const vcKey = pill.getAttribute('data-vc');
        const data = vcDebates[vcKey];

        if (data) {
          // Update headers
          activeVcTitle.textContent = `${data.name} — ${data.role}`;
          activeVcSub.textContent = data.sub;
          
          // Update consensus badge
          activeVcSentiment.className = `consensus-badge`;
          if (data.sentimentClass === 'sentiment-invest') {
            activeVcSentiment.classList.add('invest');
          } else if (data.sentimentClass === 'sentiment-pass') {
            activeVcSentiment.classList.add('pass');
          }
          activeVcSentiment.innerHTML = `
            <span class="sentiment-dot ${data.sentimentClass}"></span>
            ${data.sentimentText}
          `;

          // Trigger chat bubbles switch animation
          chatMessagesContainer.innerHTML = `
            <div class="chat-bubble" style="opacity: 0; transform: translateY(10px); transition: all 0.3s ease;">
              <div class="chat-bubble-content">
                <span class="chat-bubble-sender">${data.name} (${data.role.replace(' Perspective', '')})</span>
                "${data.message}"
              </div>
            </div>
            <div class="chat-bubble ai-assistant" style="align-self: flex-end; flex-direction: row-reverse; opacity: 0; transform: translateY(10px); transition: all 0.3s ease 0.15s;">
              <div class="chat-bubble-content" style="background: rgba(14, 165, 233, 0.05); border-color: rgba(14, 165, 233, 0.15); border-radius: 1rem 0 1rem 1rem;">
                <span class="chat-bubble-sender" style="text-align: right;">PitchNest Response Recommendation</span>
                "${data.advice}"
              </div>
            </div>
          `;

          // Animate in bubbles
          setTimeout(() => {
            const bubbles = chatMessagesContainer.querySelectorAll('.chat-bubble');
            bubbles.forEach(b => {
              b.style.opacity = '1';
              b.style.transform = 'translateY(0)';
            });
          }, 50);
        }
      });
    });
  }

  // ==========================================
  //   6. FUNDABILITY SCORE RADIAL ANIMATION
  // ==========================================
  const scoreDashboard = document.querySelector('.score-dashboard');
  const scorePath = document.getElementById('radial-score-path');
  const liveScoreText = document.getElementById('live-score-text');

  let animationTriggered = false;

  const triggerScoreAnimation = () => {
    if (animationTriggered || !scorePath) return;
    animationTriggered = true;

    // SVG stroke circumference is 440. 84% score = 440 * (1 - 0.84) = 70.4 offset
    const finalOffset = 440 * (1 - 0.84);
    scorePath.style.strokeDashoffset = finalOffset;

    // Animate score counter numbers from 0 to 84
    let currentNum = 0;
    const finalNum = 84;
    const duration = 2000; // 2s
    const stepTime = Math.abs(Math.floor(duration / finalNum));

    const counterInterval = setInterval(() => {
      currentNum++;
      liveScoreText.textContent = currentNum;
      if (currentNum === finalNum) {
        clearInterval(counterInterval);
      }
    }, stepTime);

    // Animate subscore bars
    const subBars = document.querySelectorAll('.sub-score-bar-fill');
    subBars.forEach(bar => {
      const val = bar.closest('.sub-score-item').querySelector('.sub-score-val').getAttribute('data-val');
      bar.style.width = `${val}%`;
    });
  };

  // Scroll observer to trigger scoreboard grading dynamically
  if (scoreDashboard) {
    const scoreObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        triggerScoreAnimation();
        scoreObserver.unobserve(scoreDashboard);
      }
    }, { threshold: 0.1 });

    scoreObserver.observe(scoreDashboard);
  }

  // ==========================================
  //   7. INTERACTIVE HEALTH CHECK DEMO
  // ==========================================
  const runHealthBtn = document.getElementById('run-health-btn');
  const ideaSelector = document.getElementById('health-idea-selector');
  const outputBox = document.getElementById('health-output-box');

  const healthData = {
    charge: {
      strengths: [
        "Low initial capex; uses community-shared charging nodes.",
        "Viral natural referral loop from host-to-driver.",
        "High-intent, recurring customer behavior patterns."
      ],
      weaknesses: [
        "High operational liability if host equipment damages vehicles.",
        "Initial localized two-sided chicken-and-egg marketplace issues."
      ],
      risks: [
        "Utility regulatory limits on host resale of electricity.",
        "Fast-charging network expansion reduces long-stay parking demand."
      ],
      concerns: [
        "\"How do you secure early density before a competitor with deep capex clones the model?\"",
        "\"What is the defense margin once major charging networks integrate home sharing?\""
      ]
    },
    slide: {
      strengths: [
        "Zero marginal cost distribution and instant scaling velocity.",
        "Fits directly into existing high-friction investment workflows.",
        "High-value subscription ceiling; VCs spend $10k+ on diligence."
      ],
      weaknesses: [
        "Low technical barriers to entry if standard models copy prompts.",
        "High risk of user churning after they successfully close their funding round."
      ],
      risks: [
        "Enterprise privacy concerns regarding uploading sensitive deck files.",
        "Shift of early-stage funding models towards non-traditional channels."
      ],
      concerns: [
        "\"How do you maintain a high annual contract value (ACV) if founders only raise once every 18 months?\"",
        "\"Is there a proprietary data loop that improves your scoring model over competitors?\""
      ]
    },
    fitness: {
      strengths: [
        "High upfront hardware revenue combined with sticky recurring memberships.",
        "Deep camera telemetry enables real physical posture correction value.",
        "Strong brand lifestyle association makes sharing highly organic."
      ],
      weaknesses: [
        "Heavy supply chain, inventory, and logistics capex requirements.",
        "High hardware manufacturing failure risks."
      ],
      risks: [
        "Post-pandemic return to physical boutique gyms reducing home demand.",
        "Rapid camera vision sensor price drops make hardware commodity fast."
      ],
      concerns: [
        "\"What is your hardware payback timeline if subscriber churn spikes during summer?\"",
        "\"How do you scale trainer content acquisition without blowing through Series A cash?\""
      ]
    }
  };

  if (runHealthBtn && ideaSelector && outputBox) {
    runHealthBtn.addEventListener('click', () => {
      const selectedKey = ideaSelector.value;
      const data = healthData[selectedKey];

      if (data) {
        // Show spinner / loading mockup
        runHealthBtn.innerHTML = `
          Analyzing Model... 
          <span style="display:inline-block; animation:spin 1s linear infinite; width:14px; height:14px; border:2px solid white; border-top:2px solid transparent; border-radius:50%; margin-left:0.5rem;"></span>
        `;
        runHealthBtn.disabled = true;
        outputBox.style.opacity = '0.3';
        outputBox.style.pointerEvents = 'none';

        // Fake AI computation time (800ms)
        setTimeout(() => {
          // Update Strengths
          const strengthsList = document.getElementById('health-strengths-list');
          strengthsList.innerHTML = data.strengths.map(s => `<li>${s}</li>`).join('');

          // Update Weaknesses
          const weaknessesList = document.getElementById('health-weaknesses-list');
          weaknessesList.innerHTML = data.weaknesses.map(w => `<li>${w}</li>`).join('');

          // Update Risks
          const risksList = document.getElementById('health-risks-list');
          risksList.innerHTML = data.risks.map(r => `<li>${r}</li>`).join('');

          // Update Concerns
          const concernsList = document.getElementById('health-concerns-list');
          concernsList.innerHTML = data.concerns.map(c => `<li>${c}</li>`).join('');

          // Reset button & box states
          runHealthBtn.innerHTML = `
            Run Health Audit
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          `;
          runHealthBtn.disabled = false;
          outputBox.style.opacity = '1';
          outputBox.style.pointerEvents = 'auto';
        }, 800);
      }
    });
  }

  // Add standard rotation spinner to CSS head
  const spinnerStyle = document.createElement('style');
  spinnerStyle.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(spinnerStyle);

  // ==========================================
  //   8. WAITLIST FORMS REDIRECTION TO SURVEY
  // ==========================================
  const waitlistForms = document.querySelectorAll('.waitlist-form');
  const toast = document.getElementById('toast');

  if (waitlistForms.length > 0) {
    waitlistForms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const btn = form.querySelector('button[type="submit"]');
        const input = form.querySelector('.waitlist-input');
        const email = input.value.trim();

        if (email) {
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Locking Spot...';
          btn.disabled = true;

          // Show welcome toast
          if (toast) {
            toast.classList.add('show');
          }

          // Delay for toast rendering, then redirect to survey with prefilled email
          setTimeout(() => {
            window.location.href = `survey.html?email=${encodeURIComponent(email)}`;
          }, 1500);
        } else {
          alert('Please enter a valid email address.');
        }
      });
    });
  }
  // ==========================================
  //   9. MOBILE TABS FOLDING LOGIC
  // ==========================================
  // A. Health Check Analyzer Mobile Tabs
  const healthTabBtns = document.querySelectorAll('.health-tab-btn');
  const healthCols = document.querySelectorAll('.health-col');
  
  if (healthTabBtns.length > 0) {
    healthTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active tab button
        healthTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle active data column
        const tabTarget = btn.getAttribute('data-tab');
        healthCols.forEach(col => {
          col.classList.remove('active');
          if (col.classList.contains(`health-col-${tabTarget}`)) {
            col.classList.add('active');
          }
        });
      });
    });
  }

  // B. Before vs After Comparison Mobile Tabs
  const compareTabBtns = document.querySelectorAll('.compare-tab-btn');
  const compareCards = document.querySelectorAll('.compare-card');

  if (compareTabBtns.length > 0) {
    compareTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active button
        compareTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle active card
        const compareTarget = btn.getAttribute('data-compare');
        compareCards.forEach(card => {
          card.classList.remove('active');
          if (card.classList.contains(`compare-${compareTarget}`)) {
            card.classList.add('active');
          }
        });
      });
    });
  }

  // ==========================================
  //   10. MOBILE HAMBURGER MENU DRAWER
  // ==========================================
  const hamburgerToggle = document.getElementById('hamburger-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link, .mobile-nav-btn');

  if (hamburgerToggle && mobileMenu) {
    hamburgerToggle.addEventListener('click', () => {
      hamburgerToggle.classList.toggle('active');
      mobileMenu.classList.toggle('active');
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburgerToggle.classList.remove('active');
        mobileMenu.classList.remove('active');
      });
    });
  }

});
