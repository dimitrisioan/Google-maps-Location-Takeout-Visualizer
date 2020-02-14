const express = require("express");

const router = express.Router();

let User = require("../models/User");
let Location = require("../models/location");

const auth = require("../scripts/authentication");

router.get("/users", async (req, res) => {
  await User.find({}, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

router.get("/user/:id", async (req, res) => {
  var obj_id = req.params.id;
  await User.findOne({ _id: obj_id }, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

router.delete("/user/:id", async (req, res) => {
  var obj_id = req.params.id;
  await User.deleteOne({ _id: obj_id }, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

router.get("/locations", async (req, res) => {
  await Location.find({}, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

router.get("/location/:id", async (req, res) => {
  let obj_id = req.params.id;
  await Location.findOne({ _id: obj_id }, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

// router.get("/locations/current_month", async (req, res) => {
//     let id = req.user.user_id;
//     let date = new Date();
//     let start_of_month = new Date(getStartOfMonthDateAsString(date)).getTime();
//     await Location.find({user_id: id, timestampMs: { $gte: start_of_month}}, (error, result) => {
//         if(error) {
//             return res.status(500).send(error);
//         }
//         res.send(result);
//     });
// });

// Get all user's the locations from a certain date and after
router.get("/locations/:from_day/:from_month/:from_year", async (req, res) => {
  let id = req.user.user_id;
  let day = req.params.from_day,
    month = req.params.from_month,
    year = req.params.from_year;
  let date = year + "-" + month + "-" + day + "T00:00:00";
  await Location.find(
    { user_id: id, timestampMs: { $gte: date } },
    (error, result) => {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result);
    }
  );
});

// Get all user's locations from a certain period of time
router.get(
  "/locations/:from_day/:from_month/:from_year/:until_day/:until_month/:until_year",
  auth.authenticationMiddleware(),
  async (req, res) => {
    let id = req.user.user_id;
    let from_day = req.params.from_day,
      from_month = req.params.from_month,
      from_year = req.params.from_year;
    let until_day = req.params.until_day,
      until_month = req.params.until_month,
      until_year = req.params.until_year;
    let from_date = from_year + "-" + from_month + "-" + from_day + "T02:00:00";
    let until_date =
      until_year + "-" + until_month + "-" + until_day + "T02:00:00";
    await Location.find(
      { user_id: id, timestampMs: { $gte: from_date, $lte: until_date } },
      (error, result) => {
        if (error) {
          return res.status(500).send(error);
        }
        res.send(result);
      }
    );
  }
);

// Get the date from which the user has uploaded data
router.get("/locations/max_date", async (req, res) => {
  let id = req.user.user_id;
  await Location.find({ user_id: id })
    .sort({ timestampMs: -1 })
    .limit(1)
    .exec(async function(error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result[0].timestampMs);
    });
});

// Get the date until which the user has uploaded date
router.get("/locations/min_date", async (req, res) => {
  let id = req.user.user_id;
  await Location.find({ user_id: id })
    .sort({ timestampMs: 1 })
    .limit(1)
    .exec(async function(error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result[0].timestampMs);
    });
});

// Get all user's locations without any parameter
router.get("/locations", async (req, res) => {
  let id = req.user.user_id;
  await Location.find({ user_id: id }, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

// Delete all user's locations
router.delete("/locations", async (req, res) => {
  let id = req.user.user_id;
  await Location.deleteMany({ user_id: id }, (error, result) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.send(result);
  });
});

// Get the number of user's records per hour
router.get(
  "/:from_day/:from_month/:from_year/:until_day/:until_month/:until_year/get_busiest_hour_of_the_day",
  async (req, res) => {
    let id = req.user.user_id;
    let from_day = req.params.from_day,
      from_month = req.params.from_month,
      from_year = req.params.from_year;
    let until_day = req.params.until_day,
      until_month = req.params.until_month,
      until_year = req.params.until_year;
    let from_date = from_year + "-" + from_month + "-" + from_day + "T02:00:00";
    let until_date =
      until_year + "-" + until_month + "-" + until_day + "T02:00:00";
    Location.aggregate([
      { $unwind: "$activity" },
      { $unwind: "$activity.activity" },
      {
        $match: {
          user_id: id,
          "activity.activity.type": {
            $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
          },
          "activity.activity.confidence": { $gte: 65 },
          timestampMs: { $gte: new Date(from_date), $lte: new Date(until_date) }
        }
      },
      { $project: { hour: { $hour: "$timestampMs"} , type: "$activity.activity.type" }},
      {
        $group: {
          _id: { hour: "$hour", type: "$type"},
          counter: { $sum: 1 }
        }
      }
    ]).exec((err, result) => {
      if (err) throw err;
      console.log(result)
      res.send(result);
    });
  }
);

// Get the number of user's records per day
router.get(
  "/:from_day/:from_month/:from_year/:until_day/:until_month/:until_year/get_busiest_day_of_the_week",
  async (req, res) => {
    let id = req.user.user_id;
    let from_day = req.params.from_day,
      from_month = req.params.from_month,
      from_year = req.params.from_year;
    let until_day = req.params.until_day,
      until_month = req.params.until_month,
      until_year = req.params.until_year;
    let from_date = from_year + "-" + from_month + "-" + from_day + "T02:00:00";
    let until_date =
      until_year + "-" + until_month + "-" + until_day + "T02:00:00";
    Location.aggregate([
        { $unwind: "$activity" },
        { $unwind: "$activity.activity" },
        {
        $match: {
          user_id: id,
          timestampMs: { $gte: new Date(from_date), $lte: new Date(until_date) },
          "activity.activity.type": {
            $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
          },
          "activity.activity.confidence": { $gte: 65 }
        }
      },
      { $project: { day: { $dayOfWeek: "$timestampMs"}, type: "$activity.activity.type" } },
      {
        $group: {
          _id: { day: "$day", type: "$type"},
          counter: { $sum: 1 }
        }
      }
    ]).exec((err, result) => {
      if (err) throw err;
      console.log(result)
      res.send(result);
    });
  }
);

// Group user's activity records 
router.get("/last_months_activities", async (req, res) => {
  let id = req.user.user_id;
  from_date = new Date(getStartOfMonthDateAsString(new Date()));
  from_date.setTime(from_date.getTime() + from_date.getTimezoneOffset() * (-1) * 60 * 1000 );
  console.log(from_date)
  Location.aggregate([
    { $unwind: "$activity" },
    { $unwind: "$activity.activity" },
    {
      $match: {
        user_id: id,
        timestampMs: { $gte: new Date(from_date) },
        "activity.activity.type": {
          $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
        },
        "activity.activity.confidence": { $gte: 65 }
      }
    },
    {
      $group: {
        _id: "$activity.activity.type",
        counter: { $sum: 1 }
      }
    }
  ]).exec((err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

// Group user's activity records 
router.get("/activities", async (req, res) => {
  let id = req.user.user_id;
  Location.aggregate([
    { $unwind: "$activity" },
    { $unwind: "$activity.activity" },
    {
      $match: {
        user_id: id,
        "activity.activity.type": {
          $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
        },
        "activity.activity.confidence": { $gte: 65 }
      }
    },
    {
      $group: {
        _id: "$activity.activity.type",
        counter: { $sum: 1 }
      }
    }
  ]).exec((err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

// Get user's eco score
router.get("/locations/get_eco_score", async (req, res) => {
  let id = req.user.user_id;
  Location.aggregate([
    { $unwind: "$activity" },
    { $unwind: "$activity.activity" },
    {
      $match: {
        user_id: id,
        "activity.activity.type": {
          $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
        },
        "activity.activity.confidence": { $gte: 65 }
      }
    },
    {
      $group: {
        _id: "$activity.activity.type",
        counter: { $sum: 1 }
      }
    }
  ]).exec((err, result) => {
    if (err) throw err;
    let scores = {
      eco_counter: 0,
      non_eco_counter: 0
    };
    for (let item of result) {
      if (
        item._id === "IN_ROAD_VEHICLE" ||
        item._id === "EXITING_VEHICLE" ||
        item._id === "IN_RAIL_VEHICLE" ||
        item._id === "IN_VEHICLE" ||
        item._id === "IN_ROAD_VEHICLE" ||
        item._id === "IN_FOUR_WHEELER_VEHICLE" ||
        item._id === "IN_CAR"
      ) {
        scores.non_eco_counter += item.counter;
      } else if (
        item._id === "WALKING" ||
        item._id === "ON_FOOT" ||
        item._id === "RUNNING" ||
        item._id === "ON_BICYCLE"
      ) {
        scores.eco_counter += item.counter;
      }
    }
    res.send(scores);
  });
});

router.get(
  "/:from_day/:from_month/:from_year/:until_day/:until_month/:until_year/get-types-of-activity",
  auth.authenticationMiddleware(),
  async (req, res) => {
    let id = req.user.user_id;
    let from_day = req.params.from_day,
      from_month = req.params.from_month,
      from_year = req.params.from_year;
    let until_day = req.params.until_day,
      until_month = req.params.until_month,
      until_year = req.params.until_year;
    let from_date = from_year + "-" + from_month + "-" + from_day + "T00:00:00";
    let until_date =
      until_year + "-" + until_month + "-" + until_day + "T00:00:00";
    Location.aggregate([
      { $unwind: "$activity" },
      { $unwind: "$activity.activity" },
      {
        $match: {
          user_id: id,
          timestampMs: { $gte: new Date(from_date), $lte: new Date(until_date) },
          "activity.activity.type": {
            $not: { $regex: "STILL|UNKNOWN|TILTING|EXITING_VEHICLE" }
          },
          "activity.activity.confidence": { $gte: 65 }
        }
      },
      {
        $group: {
          _id: "$activity.activity.type",
          counter: { $sum: 1 }
        }
      }
    ]).exec((err, result) => {
      if (err) throw err;
      res.send(result);
    });
  });

router.get(
  "/heatmap_locations",
  auth.authenticationMiddleware(),
  async (req, res) => {
    let id = req.user.user_id;
    let lat_and_lngs = [];
    let location = {
      lat: Number,
      lng: Number,
      counter: Number
    };
    await Location.find({ user_id: id }, async (error, result) => {
      if (error) {
        return res.status(500).send(error);
      }
      for (let item of result) {
        location = {
          lat: item.latitudeE7 / 10000000,
          lng: item.longitudeE7 / 10000000,
          counter: 1
        };
        lat_and_lngs.push(location);
      }
      res.send(lat_and_lngs);
    });
  }
);

function getStartOfMonthDateAsString(date) {
  function zerosPad(number, numOfZeros) {
    var zero = numOfZeros - number.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + number;
  }

  var day = zerosPad(1, 2);
  var month = zerosPad(date.getMonth() + 1, 2);
  var year = date.getFullYear();

  return year + "-" + month + "-" + day + "T00:00:00";
}

module.exports = router;
