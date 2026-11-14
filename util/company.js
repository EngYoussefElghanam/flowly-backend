/** Resolve the business owner used to scope company records. */
module.exports = (user) => (user.role === 'OWNER' ? user.id : user.ownerId);
