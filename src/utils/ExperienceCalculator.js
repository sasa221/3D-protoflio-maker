/**
 * ExperienceCalculator.js
 * Utility helper to compute factual professional experience metrics.
 * Calculates exact years & months from experience intervals avoiding double counting overlapping roles.
 */

export function calculateProfessionalExperience(experience) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return { totalMonths: 0, years: 0, months: 0, label: '', roleCount: 0 };
  }

  const roleCount = experience.length;
  let intervals = [];

  experience.forEach(exp => {
    if (!exp || !exp.startDate) return;

    let startYear = parseInt(exp.startDate, 10);
    let startMonth = 0; // Default Jan

    const startMatch = String(exp.startDate).match(/(?:(\d{1,2})[\/\-])?(\d{4})/);
    if (startMatch) {
      if (startMatch[1]) startMonth = Math.max(0, parseInt(startMatch[1], 10) - 1);
      startYear = parseInt(startMatch[2], 10);
    }

    if (isNaN(startYear) || startYear < 1970 || startYear > 2099) return;

    let start = new Date(startYear, startMonth, 1).getTime();
    let end;

    if (exp.current || !exp.endDate || String(exp.endDate).toLowerCase().includes('present')) {
      end = new Date().getTime();
    } else {
      let endYear = parseInt(exp.endDate, 10);
      let endMonth = 11; // Default Dec

      const endMatch = String(exp.endDate).match(/(?:(\d{1,2})[\/\-])?(\d{4})/);
      if (endMatch) {
        if (endMatch[1]) endMonth = Math.max(0, parseInt(endMatch[1], 10) - 1);
        endYear = parseInt(endMatch[2], 10);
      }

      if (isNaN(endYear)) {
        end = new Date().getTime();
      } else {
        end = new Date(endYear, endMonth, 28).getTime();
      }
    }

    if (start <= end) {
      intervals.push([start, end]);
    }
  });

  if (intervals.length === 0) {
    return { totalMonths: 0, years: 0, months: 0, label: '', roleCount };
  }

  // Merge overlapping intervals
  intervals.sort((a, b) => a[0] - b[0]);
  let merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    let last = merged[merged.length - 1];
    let curr = intervals[i];
    if (curr[0] <= last[1]) {
      last[1] = Math.max(last[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  // Calculate total months
  let totalMs = merged.reduce((acc, [s, e]) => acc + (e - s), 0);
  let totalMonths = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24 * 30.4375)));
  let years = Math.floor(totalMonths / 12);
  let remainingMonths = totalMonths % 12;

  let label = '';
  if (years > 0) {
    label = `${years}+ Year${years > 1 ? 's' : ''} Experience`;
  } else if (totalMonths > 0) {
    label = `${totalMonths} Month${totalMonths > 1 ? 's' : ''} Experience`;
  }

  return {
    totalMonths,
    years,
    months: remainingMonths,
    label,
    roleCount
  };
}
