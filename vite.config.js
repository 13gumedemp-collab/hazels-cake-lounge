import { defineConfig } from 'vite';

// Static multi-page site: include both index.html and contact.html in the build.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        menu: 'menu.html',
        story: 'story.html',
        contact: 'contact.html',
        contactme: 'contact-me.html',
      },
    },
  },
});
