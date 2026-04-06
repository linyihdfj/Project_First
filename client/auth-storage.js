(function exposeAuthStorage(global) {

  function createAuthStorage(storageKey) {

    function getAuthToken() {
      return localStorage.getItem(storageKey) || "";
    }

    function setAuthToken(token) {
      localStorage.setItem(storageKey, token);
    }

    function removeAuthToken() {
      localStorage.removeItem(storageKey);
    }

    return {
      getAuthToken,
      setAuthToken,
      removeAuthToken,
    };
  }

  global.createAuthStorage = createAuthStorage;
})(window);
