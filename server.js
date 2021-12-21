const cors = require("cors"); // allows/disallows cross-site communication
const express = require("express");
const compression = require("compression");

const app = express();

app.use(express.urlencoded({ limit: "100mb", extended: false })); //Parse URL-encoded bodies
app.use(express.json());
// app.use(fileUpload()); //. new
// var fileUpload = require("express-fileupload"); //. new

const corsOptions = {
  origin: function (origin, callback) {
    //console.log("** Origin of request " + origin)
    callback(null, true);
    // if (cfg.APP_CONST.WHITE_LIST.indexOf(origin) !== -1 || !origin) {
    //   //console.log("Origin acceptable");
    //   callback(null, true);
    // } else {
    //   console.log("Origin rejected");
    //   callback(new Error('Not allowed by CORS'));
    // }
  },
  credentials: true, // required to pass
  methods: "GET,HEAD,POST,PATCH,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization, X-Requested-With",
};
app.use(cors(corsOptions));
// app.use(cors());
// compress all responses
app.use(compression());

const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const vars = require("./vars.json");
const { textContent } = require("domutils");

const scrape = async (argv) => {
  if (argv.q === undefined || argv.q === "") {
    throw new Error("NO_KEYWORD");
  }
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  var products = [];
  var index = 1;
  while (products.length < 100) {
    var url = `https://www.tokopedia.com/p/handphone-tablet/handphone?page=${index}`;

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36"
    );

    await page.goto(url);
    await page.setViewport({ width: 1200, height: 800 });
    await autoScroll(page);
    const pageContent = await page.content();

    const $ = cheerio.load(pageContent);

    if ($("#promo-not-found").length === 1) {
      browser.close();
      throw new Error("NO_RESULT");
    }

    // Get node with designated CSS class (product)
    const productGrid = $(".css-13l3l78");
    for (
      var i = 0 + (index * 1 - 1);
      i < productGrid.eq(0).children().length * (index * 1);
      i++
    ) {
      if (products.length == 100) {
        break;
      }
      var colData = await getProducts(i, $, productGrid);
      products.push(colData);
    }
    index++;
    console.log(products.length);
  }

  await browser.close();
  var _dirname = require("path").resolve("./");

  const createCsvWriter = require("csv-writer").createObjectCsvWriter;
  const csvWriter = createCsvWriter({
    path: _dirname + "/" + "top100.csv",
    header: [
      { id: "productName", title: "productName" },
      { id: "productPrice", title: "productPrice" },
      { id: "productLink", title: "productLink" },
      { id: "productImage", title: "productImage" },
      { id: "shopName", title: "shopName" },
      { id: "shopLocation", title: "shopLocation" },
      { id: "reviewStars", title: "reviewStars" },
    ],
  });

  const data = products;

  var res = await csvWriter.writeRecords(data);
  // .then(() => console.log("The CSV file was written successfully"));

  return products;
};

async function getProducts(i, $, productGrid) {
  const productName = $(".css-1bjwylw").eq(i).text();
  let productPrice = $(".css-o5uqvq").eq(i).text();
  productPrice = unformatMoney(productPrice);
  // Name of Product
  // 2. Description
  // 3. Image Link
  // 4. Price
  // 5. Rating (out of 5 stars)
  // 6. Name of store or merchant
  const productLink = $("a", productGrid).attr("href");
  const productImage = $("img", productGrid).attr("src");
  const shopLocation = $(".css-vbihp9").eq(i).children().eq(0).text();
  const shopName = $(".css-vbihp9").eq(i).children().eq(1).text();

  let reviewStars = 0;
  let nodereviews = $(".css-153qjw7").eq(i).children().children();
  for (let index = 0; index < nodereviews.length; index++) {
    var src = nodereviews.eq(index).attr("src");
    if (
      src ==
      "https://assets.tokopedia.net/assets-tokopedia-lite/v2/zeus/kratos/4fede911.svg"
    ) {
      reviewStars++;
    }
  }

  const colData = {
    productName,
    productPrice,
    productLink,
    productImage,
    shopName,
    shopLocation,
    reviewStars,
  };

  return colData;
}

// Credit to chenxiaochun
// https://github.com/chenxiaochun/blog/issues/38
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

function unformatMoney(money) {
  let num = money;
  num = num.split("Rp").pop();
  num = num.split(".");
  return Number(num.join(""));
}

app.get("/api/scrap", async function (req, res) {
  var response = {
    error: false,
    data: null,
  };
  try {
    response.data = await scrape({ q: "phone" });
  } catch (error) {
    response.error = true;
    response.data = error;
  }
  res.send(response);
});

app
  .listen(3000, (req, res) => {
    console.log(`listening 3000`);
  })
  .on("error", function (err) {
    console.log(`@Listen: ${err}`);
  });
module.exports = app;
