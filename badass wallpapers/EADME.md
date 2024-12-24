# 🖼️ **Badass Wallpapers**  
> *The ultimate hub for high-quality, badass wallpapers to style your screens!*

---

## ✨ **About**
<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square">
  <img src="https://img.shields.io/badge/Website-Created--On-December--23--2024-green?style=flat-square">
</p>

Welcome to the **official GitHub repository** for **Badass Wallpapers**!  
A project by **The.Zane.Nelson**, designed to bring stunning wallpapers directly to your screens.  
⚡ *Stay badass with us!* ⚡

---

## 🛠️ **Features**
- **Responsive Design:** Perfect on any device.  
- **Smooth Interactions:** Hover animations, SVG buttons for download/share.  
- **Pexels API:** Dynamic wallpapers fetched seamlessly.  
- **Social Integration:** Easy access to our YouTube and WhatsApp channels.

---

## ⌨️ **Dynamic Typer Animation**
<div style="font-size: 1.5em; font-family: 'Courier New', Courier, monospace;">
  <span id="typewriter"></span>
</div>
<script>
  const phrases = [
    "Badass Wallpaper Official Channel 🌟",
    "Made by The.Zane.Nelson 💻",
    "Created on: December 23, 2024 🗓️",
    "Follow us on Social Media 🔗"
  ];
  let i = 0, j = 0, currentPhrase = "", isDeleting = false;
  const speed = 150; // Typing speed

  function type() {
    if (i < phrases.length) {
      currentPhrase = isDeleting
        ? phrases[i].substring(0, j--)
        : phrases[i].substring(0, j++);

      document.getElementById("typewriter").innerText = currentPhrase;

      if (!isDeleting && j === phrases[i].length) {
        setTimeout(() => (isDeleting = true), 1000);
      } else if (isDeleting && j === 0) {
        i++;
        j = 0;
        isDeleting = false;
      }
      setTimeout(type, isDeleting ? speed / 2 : speed);
    }
  }

  type();
</script>

---

## 🌐 **Connect with Us**
<p align="center">
  <a href="https://www.youtube.com/@BadassWallpapers" target="_blank">
    <img src="https://upload.wikimedia.org/wikipedia/commons/9/9e/YouTube_Logo_2017.svg" alt="YouTube Channel" width="150" style="border-radius: 10px;">
  </a>
  &nbsp;&nbsp;
  <a href="https://whatsapp.com/channel/0029VaivPm93QxRxq865UO1M" target="_blank">
    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp Channel" width="50">
  </a>
</p>

---

## 🌟 **Follow Us**
- **YouTube:** [Badass Wallpapers](https://www.youtube.com/@BadassWallpapers)  
- **WhatsApp:** [Join our Channel](https://whatsapp.com/channel/0029VaivPm93QxRxq865UO1M)

---

### 🚀 **Show Some Love!**
If you like this project, don’t forget to:  
⭐ **Star** the repository.  
🍴 **Fork** it and customize.  
💬 **Share** it with your friends!

---
> 🖤 *Stay badass, stay creative!*  
