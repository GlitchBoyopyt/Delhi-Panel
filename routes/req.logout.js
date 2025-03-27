router.get("/auth/logout", (req, res, next) => {
  req.logout();
  req.session.destroy(err => {
    if (err) return next(err);
    res.redirect("/");
  });
});
