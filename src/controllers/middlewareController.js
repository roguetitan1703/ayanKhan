import connection from "../config/connectDB.js";

const middlewareController = async (req, res, next) => {
  // Log full incoming request
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(`Incoming Request: ${req.method} ${fullUrl}`);
  console.log("Query Params:", req.query);

  // Optionally log return_url if present
  if (req.query.return_url) {
    console.log("Return URL Detected:", req.query.return_url);
  }

  // Retrieve token from cookies
  const auth = req.cookies.auth;

  try {
    const [rows] = await connection.query(
      "SELECT `token`, `status` FROM `users` WHERE `token` = ? AND `veri` = 1",
      [auth],
    );

    if (!rows) {
      res.clearCookie("auth");
      return res.end();
    }

    if (auth === rows[0].token && rows[0].status === "1") {
      req.userToken = auth;
      next();
    } else {
      return res.redirect("/login");
    }
  } catch (error) {
    return res.redirect("/login");
  }
};

export default middlewareController;
