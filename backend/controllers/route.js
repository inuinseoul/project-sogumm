/**
 * Router
 * @param app
 */
module.exports = (app) => {
  app
    .get('/', (req, res) => {
      res.render('index.ejs', {
        title: '',
      });
    })
    .get('/conference', (req, res) => {
      res.render('examples/conference/index.ejs', {
        title: '- 화상회의',
      });
    })
};
