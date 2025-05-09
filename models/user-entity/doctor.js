const mongoose = require("mongoose");
const User = require("./user");

const shiftSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      enum: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Poniedziałek",
        "Wtorek",
        "Środa",
        "Czwartek",
        "Piątek",
        "Sobota",
        "Niedziela",
      ],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { _id: false }
);

const offScheduleSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    timeRanges: [
      {
        startTime: {
          type: String,
          required: true,
        },
        endTime: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema({
  d_id: String,
  specialization: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Specialization",
    },
  ],
  qualifications: [String],
  experience: Number,
  bio: String,
  consultationFee: Number,
  offlineConsultationFee: {
    type: Number,
    default: 0
  },
  onlineConsultationFee: {
    type: Number,
    default: 0
  },
  patients: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  department: {
    type: String,
    enum: [
      "Cardiology",
      "Dermatology",
      "Neurology",
      "Orthopedics",
      "Pediatrics",
      "Psychiatry",
      "Obstetrics & Gynecology",
      "Oncology",
      "Ophthalmology",
      "Urology",
      "Endocrinology",
      "Gastroenterology",
      "Pulmonology",
      "Nephrology",
      "Rheumatology",
    ],
  },

  weeklyShifts: [shiftSchema],

  offSchedule: [offScheduleSchema],
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
  },
  ratings: {
    type: Number,
    default: 0,
  },

  votes: {
    type: Number,
    default: 0,
  },

  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
      },
      review: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

doctorSchema.virtual("isAvailable").get(function () {
  const now = new Date();
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
  const currentTime = now.toTimeString().slice(0, 5);

  const shift = this.weeklyShifts?.find((s) => s.dayOfWeek === currentDay);
  if (!shift) return false;

  if (currentTime < shift.startTime || currentTime >= shift.endTime) {
    return false;
  }

  const todayOff = this.offSchedule?.find(
    (off) =>
      off.date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
  );

  if (todayOff) {
    for (const range of todayOff.timeRanges) {
      if (currentTime >= range.startTime && currentTime < range.endTime) {
        return false;
      }
    }
  }

  return true;
});

doctorSchema.virtual("averageRating").get(function () {
  if (!this.reviews?.length) return 0;
  const sum = this.reviews?.reduce((acc, curr) => acc + curr.rating, 0);
  return Math.round((sum / this.reviews.length) * 10) / 10;
});

doctorSchema.set("toJSON", { virtuals: true });
doctorSchema.set("toObject", { virtuals: true });
//const doctor = await Doctor.findById(id);
//console.log(doctor.isAvailable); // true or false//
module.exports = User.discriminator("doctor", doctorSchema);
