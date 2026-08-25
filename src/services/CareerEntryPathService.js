export function getCareerEntryPaths(isAuthenticated = false) {
  return {
    buildCV: isAuthenticated ? '/cv/new' : '/login?next=%2Fcv%2Fnew',
    importCV: isAuthenticated ? '/cv/new?mode=import' : '/login?next=%2Fcv%2Fnew%3Fmode%3Dimport',
    portfolio: isAuthenticated ? '/studio' : '/login?next=%2Fstart'
  };
}
