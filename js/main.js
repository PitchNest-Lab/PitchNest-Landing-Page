document.addEventListener('DOMContentLoaded', () => {
  // 1. Scroll animations (Reveal)
  const revealElements = document.querySelectorAll('.reveal');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Optional: stop observing once revealed
        // revealObserver.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // 2. Navbar scroll effect
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.add('scrolled');
    }
  });

  // Ensure navbar is styled correctly on load
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  // 3. Testimonials Carousel Swipe Logic
  const track = document.getElementById('testimonials-track');
  const dotsContainer = document.getElementById('carousel-dots');
  
  if (track && dotsContainer) {
    const cards = Array.from(track.children);
    const cardWidth = cards[0].getBoundingClientRect().width + 24; // width + gap
    
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
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
      
      dots.forEach(d => d.classList.remove('active'));
      dots[currentIndex].classList.add('active');
    }
    
    // Auto advance
    let autoPlayInterval = setInterval(() => {
      let nextIndex = (currentIndex + 1) % cards.length;
      goToSlide(nextIndex);
    }, 4000);
    
    // Pause on hover
    track.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    track.addEventListener('mouseleave', () => {
      autoPlayInterval = setInterval(() => {
        let nextIndex = (currentIndex + 1) % cards.length;
        goToSlide(nextIndex);
      }, 4000);
    });
    
    // Basic Touch/Swipe support
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
      }, 4000);
    });
  }

  // 4. Form submission & VIP Survey Redirect
  const forms = document.querySelectorAll('.waitlist-form');
  
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Joining...';
      btn.disabled = true;
      
      try {
        const formData = new FormData(form);
        const email = formData.get('email');
        
        if (email) {
          // Immediately redirect to step 2 (Survey) instead of doing a backend POST
          window.location.href = `survey.html?email=${encodeURIComponent(email)}`;
        } else {
          alert("Please enter a valid email address.");
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      } catch (error) {
        console.error("Redirect error:", error);
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  });
  
  function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 5000);
  }
});
