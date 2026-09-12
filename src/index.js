export default {
    async fetch(request, env) {
      const url = new URL(request.url);
  
      if (
        url.pathname === "/class-scheduler" ||
        url.pathname.startsWith("/class-scheduler/")
      ) {
        return env.CLASS_SCHEDULER.fetch(request);
      }
  
      return env.ASSETS.fetch(request);
    },
  };