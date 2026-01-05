/**
 * Sanitizes and conforms a matrix object to a strict schema.
 * This is not just a default, but a transformation to ensure data integrity.
 *
 * @param {object | null} matrix - The raw matrix object from AI or DB.
 * @param {'productivity' | 'performance'} type - The type of matrix.
 * @returns {object | null} A schema-compliant matrix object or null.
 */
export const sanitizeAndConformMatrix = (matrix, type) => {
  if (!matrix || typeof matrix !== 'object') {
    return null;
  }

  const sanitized = {
    title: typeof matrix.title === 'string' ? matrix.title : `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)} Matrix`,
    columns: [],
  };

  if (Array.isArray(matrix.columns)) {
    sanitized.columns = matrix.columns.map(col => {
      if (!col || typeof col !== 'object') return null;

      const newCol = {
        name: typeof col.name === 'string' ? col.name : 'Untitled Area',
      };

      if (type === 'productivity') {
        newCol.deliverables = Array.isArray(col.deliverables) ? col.deliverables.map(d => typeof d === 'string' ? d : '') : [];
      } else { // performance
        newCol.problems = Array.isArray(col.problems) ? col.problems.map(p => {
          if (!p || typeof p !== 'object') {
            return { problem: '', expert: '', strategy: '' };
          }
          return {
            problem: typeof p.problem === 'string' ? p.problem : '',
            expert: typeof p.expert === 'string' ? p.expert : '',
            strategy: typeof p.strategy === 'string' ? p.strategy : '',
          };
        }) : [];
      }
      return newCol;
    }).filter(Boolean); // Remove any null columns that failed validation
  }

  return sanitized;
};