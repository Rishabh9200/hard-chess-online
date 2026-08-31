const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('Hard Chess online server running on port ' + PORT);
});
